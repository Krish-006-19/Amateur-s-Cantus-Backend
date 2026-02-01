// Usage:
//   node scripts/db-sanity.js
// Requires MONGODB_URI in environment (or backend/.env)

require('dotenv').config({ override: true });

const mongoose = require('mongoose');

const Auth = require('../models/auth.model');
const Artist = require('../models/artist.model');
const Music = require('../models/music.model');

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const activeStatusQuery = {
    $or: [{ status: 'active' }, { status: { $exists: false } }, { status: null }],
  };

  const activeAuthIds = (await Auth.distinct('_id', activeStatusQuery)).map(String);

  const activeArtists = await Artist.find(activeStatusQuery).select('_id details');
  const activeArtistIds = activeArtists
    .filter((artist) => artist?.details && activeAuthIds.includes(String(artist.details)))
    .map((artist) => String(artist._id));

  const totalMusic = await Music.countDocuments();
  const removedMusic = await Music.countDocuments({ status: 'removed' });
  const wouldSoftRemove = await Music.countDocuments({
    uploadedBy: { $nin: activeArtistIds },
    status: { $ne: 'removed' },
  });

  // Helpful extra: show last 3 music docs (if any)
  const lastMusic = await Music.find({})
    .sort({ createdAt: -1, _id: -1 })
    .limit(3)
    .select('_id title uploadedBy createdAt');

  console.log(
    JSON.stringify(
      {
        activeAuthCount: activeAuthIds.length,
        activeArtistCount: activeArtistIds.length,
        totalMusic,
        removedMusic,
        wouldSoftRemove,
        lastMusic,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('db-sanity failed:', error?.message || error);
  process.exit(1);
});
