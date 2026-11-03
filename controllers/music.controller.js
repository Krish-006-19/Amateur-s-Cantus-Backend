const musicModel = require("../models/music.model");
const Artist = require("../models/artist.model");
const Consumer = require("../models/consumer.model");
const { hardDeleteMusicById } = require('../utilities/cascadeDelete');
const { deleteCacheKeys } = require('../middlewares/cache');
const { musicListKey, musicDetailKey } = require('../utilities/cacheKeys');
const { SONG_UPLOADS_PER_DAY } = require('../middlewares/appLimits');

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
    updateMusic,
    updateLikes,
  updatePlays,
  deleteMusicById,
};
