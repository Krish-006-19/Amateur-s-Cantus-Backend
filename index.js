require('dotenv').config();
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const bcrypt = require('bcrypt');
const path = require('path');
app.use(require("cookie-parser")());

// Allow req.ip to respect X-Forwarded-For when behind a proxy (Render/NGINX/etc).
// This also improves correctness if you ever use IP-based rate limits.
app.set('trust proxy', 1);

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

const cors = require('cors');
const { ensureRedisConnected } = require('./utilities/redis');
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // allow same-origin, curl/postman (no origin), and dev by default
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Warm up Redis connection (non-fatal if unavailable)
ensureRedisConnected().catch(() => {});

// Register models early so mongoose.model(...) works everywhere.
require('./models/auth.model');
require('./models/admin.model');
require('./models/artist.model');
require('./models/consumer.model');
require('./models/music.model');
require('./models/report.model');

// Static local uploads (useful if you ever keep files locally)
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ACantus";

async function ensureDefaultAdmin() {
  const email = String(process.env.DEFAULT_ADMIN_EMAIL || 'admin24@krishramenadbuser.com')
    .toLowerCase()
    .trim();
  const password = String(process.env.DEFAULT_ADMIN_PASSWORD || '1234567890');
  const usernameBase = String(process.env.DEFAULT_ADMIN_USERNAME || 'admin24').trim() || 'admin24';

  if (!email || !password) return;

  const Auth = mongoose.model('Auth');
  const Admin = mongoose.model('Admin');

  let user = await Auth.findOne({ email });
  if (!user) {
    const hashed = await bcrypt.hash(password, 10);
    // Ensure a unique username (email is used for login).
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const username = attempt === 0 ? usernameBase : `${usernameBase}${attempt}`;
      try {
        user = await Auth.create({
          username,
          email,
          password: hashed,
          role: 'admin',
          status: 'active',
        });
        break;
      } catch (err) {
        // Duplicate username; retry with a suffix.
        if (err && err.code === 11000 && (err.keyPattern?.username || err.keyValue?.username)) {
          continue;
        }
        throw err;
      }
    }
  } else {
    let changed = false;

    if (user.role !== 'admin') {
      user.role = 'admin';
      changed = true;
    }

    if (user.status !== 'active') {
      user.status = 'active';
      changed = true;
    }

    const passwordOk = await bcrypt.compare(password, user.password).catch(() => false);
    if (!passwordOk) {
      user.password = await bcrypt.hash(password, 10);
      changed = true;
    }

    if (changed) {
      await user.save();
    }
  }

  if (user && user._id) {
    const adminDoc = await Admin.findOne({ authDetails: user._id });
    if (!adminDoc) await Admin.create({ authDetails: user._id });
  }
}

mongoose
  .connect(mongoUri, {
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000),
    connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 10000),
  })
  .then(() => {
    console.log("Mongo connected!");
    ensureDefaultAdmin()
      .then(() => console.log('Default admin ensured'))
      .catch((err) => console.warn('Default admin seed failed:', err && err.message ? err.message : err));
    const orphanCleanerEnabled = String(process.env.ORPHAN_CLEANER_ENABLED || 'true').toLowerCase() !== 'false';
    if (orphanCleanerEnabled) {
      startOrphanCleaner();
    } else {
      console.warn('[orphanCleaner] Disabled via ORPHAN_CLEANER_ENABLED=false');
    }
  })
  .catch((err) => console.error(err));

mongoose.connection.on('error', (err) => {
  console.error('Mongo connection error:', err && err.message ? err.message : err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('Mongo disconnected');
});

// Fail fast while DB is down/unreachable (Atlas IP whitelist, bad URI, etc)
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  if (!req.path.startsWith('/api') && !req.path.startsWith('/upload')) return next();

  const ready = mongoose.connection.readyState === 1;
  if (ready) return next();

  return res.status(503).json({
    message: 'Database not connected. Check MONGODB_URI and Atlas Network Access (IP whitelist).',
  });
});

async function orphanCleaner() {
  try {
    const Artist = mongoose.model("Artist");
    const Music = mongoose.model("Music");
    const Report = mongoose.model("Report");
    const Consumer = mongoose.model("Consumer");

    const Auth = mongoose.model('Auth');

    // Only active artists with active auth accounts should have visible music.
    // Treat missing status as active (backward compatible) and compare ids as strings.
    const activeStatusQuery = { $or: [{ status: 'active' }, { status: { $exists: false } }, { status: null }] };

    const activeAuthIds = new Set(
      (await Auth.distinct('_id', activeStatusQuery)).map((id) => String(id))
    );

    const activeArtists = await Artist.find(activeStatusQuery).select('_id details');
    const activeArtistIds = activeArtists
      .filter((a) => a && a.details && activeAuthIds.has(String(a.details)))
      .map((a) => a._id);

    // Safety guard: never delete everything due to an empty active set.
    if (!activeArtistIds.length) {
      console.warn('[orphanCleaner] Skipping cleanup: no active artists detected');
      return;
    }

    // Non-destructive: do NOT hard delete music. Soft-remove it so it can be recovered.
    const musicRes = await Music.updateMany(
      { uploadedBy: { $nin: activeArtistIds }, status: { $ne: 'removed' } },
      { $set: { status: 'removed' } }
    );

    const reportRes = await Report.deleteMany({
      reportedAgainst: { $nin: activeArtistIds },
    });

    const musicIds = await Music.distinct("_id");

    await Consumer.updateMany(
      {},
      { $pull: { playlist: { $nin: musicIds } } }
    );

    // Invalidate cache so users don't see stale lists.
    try {
      const redis = await ensureRedisConnected();
      if (redis) await redis.del('cache:music:list');
    } catch (_) {
      // ignore
    }

    console.log("Orphan cleanup:", {
      musicSoftRemoved: musicRes.modifiedCount ?? musicRes.nModified ?? 0,
      reportsDeleted: reportRes.deletedCount,
    });
  } catch (err) {
    console.error("Orphan cleaner error:", err);
  }
}

function startOrphanCleaner() {
  orphanCleaner();
  setInterval(orphanCleaner, 1000 * 60 * 10);
}
app.get("/",async(req,res)=>{
  return {"Status":"ok"};
})
app.use("/api/consumer", require("./routes/consumer.route.js"));
app.use("/api/artist", require("./routes/artist.route.js"));
app.use("/api/music", require("./routes/music.route.js"));
app.use("/api/auth", require("./routes/auth.route.js"));
app.use("/api/admin", require("./routes/admin.route.js"));
app.use("/api/report", require("./routes/report.route.js"));
app.use("/upload", require("./routes/upload.route.js"));

app.use((err, _req, res, _next) => {
  const message = err && err.message ? err.message : 'Server Error';
  res.status(400).json({ message });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, _=>console.log(`Server is running at http://localhost:${PORT}`));
