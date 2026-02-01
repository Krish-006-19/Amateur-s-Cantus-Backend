const Music = require('../models/music.model');
const Consumer = require('../models/consumer.model');
const Report = require('../models/report.model');
const { deleteAudioFromCloudinary, deleteImageFromCloudinary } = require('./cloudinary');
const { deleteCacheKeys } = require('../middlewares/cache');
const { musicListKey, musicDetailKey } = require('./cacheKeys');

async function hardDeleteMusicById(musicId) {
  if (!musicId) return { deleted: false, reason: 'missing_id' };

  const music = await Music.findById(musicId).select(
    '_id uploadedBy musicAudioPublicId musicImagePublicId'
  );
  if (!music) return { deleted: false, reason: 'not_found' };

  // Remove references first (best-effort)
  await Consumer.updateMany({}, { $pull: { playlist: music._id } }).catch(() => {});
  await Report.deleteMany({ music: music._id }).catch(() => {});

  // Delete Cloudinary assets (best-effort)
  if (music.musicAudioPublicId) {
    await deleteAudioFromCloudinary(music.musicAudioPublicId).catch(() => {});
  }
  if (music.musicImagePublicId) {
    await deleteImageFromCloudinary(music.musicImagePublicId).catch(() => {});
  }

  await Music.deleteOne({ _id: music._id }).catch(() => {});

  await deleteCacheKeys([musicListKey(), musicDetailKey(String(music._id))]).catch(() => {});

  return { deleted: true, id: music._id };
}

async function hardDeleteAllMusicForArtist(artistId) {
  if (!artistId) return { deletedCount: 0 };

  const musicDocs = await Music.find({ uploadedBy: artistId }).select(
    '_id musicAudioPublicId musicImagePublicId'
  );

  for (const doc of musicDocs) {
    await hardDeleteMusicById(doc._id);
  }

  // Also remove any remaining reports against the artist (may include already-deleted music)
  await Report.deleteMany({ reportedAgainst: artistId }).catch(() => {});

  // Invalidate list once more to be safe
  await deleteCacheKeys([musicListKey()]).catch(() => {});

  return { deletedCount: musicDocs.length };
}

module.exports = {
  hardDeleteMusicById,
  hardDeleteAllMusicForArtist,
};
