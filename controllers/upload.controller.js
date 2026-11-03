const crypto = require('crypto');
const { extensionFor, createUploadUrl, headObject, deleteObject, cdnUrl } = require('../utilities/s3');
const Music = require('../models/music.model');
const Artist = require('../models/artist.model');
const { deleteCacheKeys } = require('../middlewares/cache');
const { musicListKey } = require('../utilities/cacheKeys');
const { SONG_UPLOADS_PER_DAY } = require('../middlewares/appLimits');

const DEFAULT_BANNER_URL =
  process.env.DEFAULT_BANNER_URL ||
  'https://via.placeholder.com/512x512.png?text=Amateur%27s+Cantus';

const KINDS = new Set(['audio', 'image', 'profileImage']);
const MAX = { audio: 6 * 1024 * 1024, image: 5 * 1024 * 1024, profileImage: 2 * 1024 * 1024 };
// Browsers sometimes report these non-standard types; normalise them.
const MIME_ALIASES = { 'audio/mp3': 'audio/mpeg', 'audio/mpeg3': 'audio/mpeg', 'image/jpg': 'image/jpeg' };

function getUtcDayStart() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Step 1: the browser asks for a short-lived URL it can PUT a file to.
async function presign(req, res) {
  const { kind, size } = req.body || {};
  const rawType = req.body && req.body.contentType;
  const contentType = MIME_ALIASES[rawType] || rawType;

  if (!KINDS.has(kind)) return res.status(400).json({ message: 'Unsupported upload type' });

  // Song audio and cover art are artist-only; any signed-in user may set a profile image.
  if (kind !== 'profileImage' && (req.userRole || req.user.role) !== 'artist') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const ext = extensionFor(contentType);
  if (!ext || (kind === 'audio') !== (contentType === 'audio/mpeg')) {
    return res.status(400).json({ message: 'Unsupported file type' });
  }
  if (!Number.isInteger(size) || size < 1 || size > MAX[kind]) {
    return res.status(400).json({ message: `File size must be between 1 byte and ${MAX[kind] / (1024 * 1024)}MB` });
  }

  try {
    const key = `uploads/${kind}/${req.user._id}/${crypto.randomUUID()}.${ext}`;
    const uploadUrl = await createUploadUrl({ key, contentType, size });
    return res.status(200).json({ key, uploadUrl, contentType, expiresIn: 300 });
  } catch (error) {
    console.error('presign failed:', error);
    return res.status(503).json({ message: 'Could not create upload URL' });
  }
}

// Confirms the object exists, belongs to this user, and matches type/size limits.
// An object that fails validation is deleted so it cannot sit in the bucket.
async function verifyObject(key, prefix, types, maxBytes) {
  if (typeof key !== 'string' || !key.startsWith(prefix) || key.includes('..')) {
    throw new Error('Invalid object key');
  }
  let object;
  try {
    object = await headObject(key);
  } catch (_) {
    throw new Error('Uploaded file not found. Upload it before completing.');
  }
  if (!types.has(object.ContentType) || !object.ContentLength || object.ContentLength > maxBytes) {
    await deleteObject(key).catch(() => {});
    throw new Error('Uploaded file failed type or size validation');
  }
  return object;
}

// Step 3: after the PUT(s) succeed, the browser sends the keys plus song metadata.
async function completeMusic(req, res) {
  const { audioKey, imageKey, title, genre, description, isPolicyAccepted } = req.body || {};

  if (!title || !description) return res.status(400).json({ message: 'Title and description are required' });
  if (String(description).length > 500) return res.status(400).json({ message: 'Description exceeds 500 characters' });
  if (isPolicyAccepted !== true && isPolicyAccepted !== 'true') {
    return res.status(400).json({ message: 'Content policy must be accepted' });
  }

  try {
    const artist = await Artist.findOne({ details: req.user._id });
    if (!artist) return res.status(404).json({ message: 'Artist not found' });
    if (artist.status !== 'active') return res.status(403).json({ message: 'Artist account is not active' });

    const maxPerDay = Number(SONG_UPLOADS_PER_DAY || 2);
    const used = await Music.countDocuments({ uploadedBy: artist._id, createdAt: { $gte: getUtcDayStart() } });
    if (used >= maxPerDay) {
      return res.status(429).json({ message: `You can upload only ${maxPerDay} songs per day.` });
    }

    const audio = await verifyObject(audioKey, `uploads/audio/${req.user._id}/`, new Set(['audio/mpeg']), MAX.audio);
    if (imageKey) {
      await verifyObject(imageKey, `uploads/image/${req.user._id}/`, new Set(['image/jpeg', 'image/png']), MAX.image);
    }

    // The same object must not back two songs: deleting one would break the other.
    if (await Music.exists({ musicAudioKey: audioKey })) {
      return res.status(409).json({ message: 'This upload has already been used' });
    }

    const music = await Music.create({
      uploadedBy: artist._id,
      title: String(title).trim(),
      genre: genre && String(genre).trim() ? String(genre).trim() : 'Unknown',
      description,
      isPolicyAccepted: true,
      musicAudio: cdnUrl(audioKey),
      musicAudioKey: audioKey,
      musicAudioPublicId: audioKey,
      musicImage: imageKey ? cdnUrl(imageKey) : DEFAULT_BANNER_URL,
      musicImageKey: imageKey || null,
      musicImagePublicId: imageKey || null,
      bytes: audio.ContentLength,
      format: 'mp3',
      status: 'approved',
    });

    await deleteCacheKeys([musicListKey()]);
    return res.status(201).json(music);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

module.exports = { presign, completeMusic };
