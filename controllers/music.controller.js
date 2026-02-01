const fs = require("fs");
const musicModel = require("../models/music.model");
const Artist = require("../models/artist.model");
const Consumer = require("../models/consumer.model");
const { uploadOnCloudinary } = require("../utilities/cloudinary");
const { hardDeleteMusicById } = require('../utilities/cascadeDelete');
const { deleteCacheKeys } = require('../middlewares/cache');
const { musicListKey, musicDetailKey } = require('../utilities/cacheKeys');
const { SONG_UPLOADS_PER_DAY } = require('../middlewares/appLimits');

const DEFAULT_BANNER_URL =
  process.env.DEFAULT_BANNER_URL ||
  "https://via.placeholder.com/512x512.png?text=Amateur%27s+Cantus";

function getUtcDayRange(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0, 0));
  return { start, end };
}

async function getUploadQuota(req, res) {
  try {
    const artist = await Artist.findOne({ details: req.user._id }).select('_id status');
    if (!artist) return res.status(404).json({ message: 'Artist not found' });
    if (artist.status !== 'active') return res.status(403).json({ message: 'Artist account is not active' });

    const { start, end } = getUtcDayRange(new Date());
    const used = await musicModel.countDocuments({
      uploadedBy: artist._id,
      createdAt: { $gte: start, $lt: end },
    });

    const max = Number(SONG_UPLOADS_PER_DAY || 2);
    const remaining = Math.max(0, max - used);
    return res.status(200).json({
      max,
      used,
      remaining,
      dayUtc: start.toISOString().slice(0, 10),
    });
  } catch (_err) {
    return res.status(500).json({ message: 'Server Error' });
  }
}

async function resolveArtistIdFromRequest(req) {
  if (req.user && req.user._id) {
    const artist = await Artist.findOne({ details: req.user._id });
    if (artist) return artist._id;
  }

  if (req.body && req.body.artistId) {
    return req.body.artistId;
  }

  if (req.query && req.query.artistId) {
    return req.query.artistId;
  }

  if (req.params && (req.params.artistId || req.params.id)) {
    return req.params.artistId || req.params.id;
  }

  return null;
}

async function getApprovedMusicList(req, res) {
    try {
    const musicList = await musicModel
      .find({ status: "approved" })
      .populate({
      path: "uploadedBy",
      match: { status: 'active' },
      populate: { path: "details", match: { status: 'active' }, select: "username profileImage status" },
      })
      .sort({ createdAt: -1 });

        const visible = (musicList || []).filter((m) => m && m.uploadedBy && m.uploadedBy.details);
        res.status(200).json(visible);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
}

async function getApprovedMusicById(req, res) {
    try {
        const music = await musicModel
          .findOne({ _id: req.params.id, status: "approved" })
          .populate({
            path: "uploadedBy",
            match: { status: 'active' },
            populate: { path: "details", match: { status: 'active' }, select: "username profileImage status" },
          });
        // Hide songs from deactivated artists/users
        if (!music || !music.uploadedBy || !music.uploadedBy.details) {
          return res.status(404).json({ message: "Music not found" });
        }
        res.status(200).json(music);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
}

async function createMusic(req, res) {
  const { title, genre, description } = req.body;

  const isPolicyAcceptedRaw = req.body.isPolicyAccepted;
  const isPolicyAccepted =
    isPolicyAcceptedRaw === undefined ? true :
    isPolicyAcceptedRaw === true || isPolicyAcceptedRaw === "true";

  if (!title || !description) {
    return res.status(400).json({ message: "Title and description are required" });
  }
  if (!isPolicyAccepted) {
    return res.status(400).json({ message: "Content policy must be accepted" });
  }
  if (description.length > 500) {
    return res.status(400).json({ message: "Description exceeds 500 characters" });
  }

  const audioFile = req.files && req.files.audio && req.files.audio[0];
  const imageFile = req.files && req.files.image && req.files.image[0];
  if (!audioFile) {
    return res.status(400).json({ message: "Audio file (mp3) is required" });
  }

  try {
    const artistId = await resolveArtistIdFromRequest(req);
    if (!artistId) return res.status(400).json({ message: "Artist id is required" });

    const artist = await Artist.findById(artistId);
    if (!artist) return res.status(404).json({ message: "Artist not found" });
    if (artist.status !== "active") return res.status(403).json({ message: "Artist account is not active" });

    // Hard guarantee: reject if the artist already uploaded max songs today (UTC).
    // This is DB-backed, so it reflects successful uploads and works even if Redis is down.
    const { start, end } = getUtcDayRange(new Date());
    const uploadedToday = await musicModel.countDocuments({
      uploadedBy: artist._id,
      createdAt: { $gte: start, $lt: end },
    });

    const maxPerDay = Number(SONG_UPLOADS_PER_DAY || 2);
    if (uploadedToday >= maxPerDay) {
      return res.status(429).json({ message: `You can upload only ${maxPerDay} songs per day.` });
    }

    // Upload audio to Cloudinary (try "video" for streaming; fallback "auto" if plan restricts video)
    let audioUpload;
    try {
      audioUpload = await uploadOnCloudinary(audioFile.path, { resource_type: "video" });
    } catch (audioErr) {
      try {
        audioUpload = await uploadOnCloudinary(audioFile.path, { resource_type: "auto" });
      } catch (autoErr) {
        try { fs.unlinkSync(audioFile.path); } catch (_) {}
        return res.status(500).json({
          message: audioErr?.message || "Failed to upload audio to cloud",
        });
      }
    }

    let imageUrl = DEFAULT_BANNER_URL;
    let imagePublicId = null;
    if (imageFile) {
      try {
        const imgUpload = await uploadOnCloudinary(imageFile.path, { resource_type: "image" });
        if (imgUpload) {
          imageUrl = imgUpload.url;
          imagePublicId = imgUpload.public_id;
        }
      } catch (_) {
        // keep default banner if image upload fails
      }
    }

    const bytes = audioFile.size;
    if (bytes > 6000000) {
      return res.status(400).json({ message: "Audio exceeds 6MB" });
    }

    const newMusic = await musicModel.create({
      uploadedBy: artist._id,
      title,
      genre: genre && String(genre).trim() ? genre : "Unknown",
      description,
      isPolicyAccepted,
      musicAudio: audioUpload.url,
      musicAudioPublicId: audioUpload.public_id,
      musicImage: imageUrl,
      musicImagePublicId: imagePublicId,
      bytes,
      format: "mp3",
      status: "approved",
    });

    // Invalidate cached lists after new uploads
    await deleteCacheKeys([musicListKey()]);

    res.status(201).json(newMusic);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
}

async function updateMusic(req, res) {
  const { title, genre, description } = req.body;
  if (description && description.length > 500) {
    return res.status(400).json({ message: "Description exceeds 500 characters" });
  }

  try {
    const music = await musicModel
      .findOne({ _id: req.params.id })
      .populate({ path: "uploadedBy", populate: { path: "details", select: "_id" } });
    if (!music) return res.status(404).json({ message: "Music not found" });

    const isOwner = await isEngagementFromOwner(req, music);
    if (!isOwner) return res.status(403).json({ message: "Only the uploader can edit this track" });

    const update = {};
    if (title !== undefined) update.title = title;
    if (genre !== undefined) update.genre = genre && String(genre).trim() ? genre : "Unknown";
    if (description !== undefined) update.description = description;
    if (music.flaggedForEdit) update.flaggedForEdit = false;

    const updatedMusic = await musicModel
      .findOneAndUpdate({ _id: req.params.id }, update, { new: true, runValidators: true })
      .populate({ path: "uploadedBy", populate: { path: "details", select: "username profileImage" } });

    if (!updatedMusic) return res.status(404).json({ message: "Music not found" });

    await deleteCacheKeys([musicListKey(), musicDetailKey(req.params.id)]);
    res.status(200).json(updatedMusic);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
}

async function isEngagementFromOwner(req, musicDoc) {
  const userId = req?.user?._id;
  if (!userId || !musicDoc) return false;

  // If uploadedBy was populated with details, use it.
  const populatedOwnerAuthId = musicDoc?.uploadedBy?.details?._id;
  if (populatedOwnerAuthId) {
    return String(populatedOwnerAuthId) === String(userId);
  }

  // Otherwise resolve Artist.details
  const artistId = musicDoc.uploadedBy;
  if (!artistId) return false;

  const artist = await Artist.findById(artistId).select('details');
  if (!artist || !artist.details) return false;
  return String(artist.details) === String(userId);
}

async function updateLikes(req, res) {
    try {
        const music = await musicModel
          .findOne({ _id: req.params.id, status: "approved" })
          .populate({ path: "uploadedBy", populate: { path: "details", select: "username profileImage _id" } });

        if (!music) return res.status(404).json({ message: "Music not found" });

        const isOwner = await isEngagementFromOwner(req, music);
        if (isOwner) return res.status(200).json(music);

        const consumer = await Consumer.findOne({ details: req.user._id });
        if (!consumer) return res.status(200).json(music);

        const alreadyLiked = music.likedBy && music.likedBy.some((id) => String(id) === String(consumer._id));
        if (alreadyLiked) return res.status(200).json(music);

        const likesUpdate = await musicModel
          .findOneAndUpdate(
            { _id: req.params.id, status: "approved" },
            { $addToSet: { likedBy: consumer._id }, $inc: { likes: 1 } },
            { new: true, runValidators: true }
          )
          .populate({ path: "uploadedBy", populate: { path: "details", select: "username profileImage" } });

        await deleteCacheKeys([musicListKey(), musicDetailKey(req.params.id)]);
        res.status(200).json(likesUpdate);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
}

async function updatePlays(req, res) {
    try {
        const music = await musicModel
          .findOne({ _id: req.params.id, status: "approved" })
          .populate({ path: "uploadedBy", populate: { path: "details", select: "username profileImage _id" } });

        if (!music) return res.status(404).json({ message: "Music not found" });

        const isOwner = await isEngagementFromOwner(req, music);
        if (isOwner) {
          return res.status(200).json(music);
        }

        const playsUpdate = await musicModel
          .findOneAndUpdate(
            { _id: req.params.id, status: "approved" },
            { $inc: { plays: 1 } },
            { new: true, runValidators: true }
          )
          .populate({ path: "uploadedBy", populate: { path: "details", select: "username profileImage _id" } });

        await deleteCacheKeys([musicListKey(), musicDetailKey(req.params.id)]);
        res.status(200).json(playsUpdate);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
}

async function deleteMusicById(req, res) {
  try {
    const music = await musicModel
      .findOne({ _id: req.params.id })
      .populate({ path: "uploadedBy", populate: { path: "details", select: "_id" } });

    if (!music) return res.status(404).json({ message: "Music not found" });

    const isAdmin = req.userRole === 'admin';
    const isOwner = await isEngagementFromOwner(req, music);
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: "Only the uploader (or admin) can delete this track" });
    }

    const result = await hardDeleteMusicById(music._id);
    if (!result || !result.deleted) return res.status(404).json({ message: "Music not found" });

    // List cache will already be invalidated by cascadeDelete, but keep it safe.
    await deleteCacheKeys([musicListKey()]);
    return res.status(200).json({ message: "Music deleted" });
  } catch (_error) {
    return res.status(500).json({ message: "Server Error" });
  }
}

module.exports = {
    getApprovedMusicList,
    getApprovedMusicById,
  getUploadQuota,
    createMusic,
    updateMusic,
    updateLikes,
  updatePlays,
  deleteMusicById,
};