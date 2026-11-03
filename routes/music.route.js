const express = require("express");
const router = express.Router();
const { optionalUser, requireUser } = require('../middlewares/auth');
const { cacheJson } = require('../middlewares/cache');
const { requireRole } = require('../middlewares/appLimits');
const { musicListKey, musicDetailKey } = require('../utilities/cacheKeys');
const {
  getApprovedMusicList,
  getApprovedMusicById,
  getUploadQuota,
  updateMusic,
  updateLikes,
  updatePlays,
  deleteMusicById
} = require("../controllers/music.controller.js");

router.get(
  "/",
  cacheJson({ key: musicListKey(), ttlSeconds: Number(process.env.CACHE_TTL_MUSIC_LIST_SECONDS || 120) }),
  getApprovedMusicList
);

// For frontend: check remaining uploads BEFORE sending large multipart FormData
router.get('/upload-quota', requireUser, requireRole('artist'), getUploadQuota);

router.patch("/:id/like", optionalUser, updateLikes);
router.patch("/:id/play", optionalUser, updatePlays);

router.get(
  "/:id",
  cacheJson({ key: (req) => musicDetailKey(req.params.id), ttlSeconds: Number(process.env.CACHE_TTL_MUSIC_DETAIL_SECONDS || 120) }),
  getApprovedMusicById
);
router.patch("/:id", requireUser, updateMusic);
router.delete("/:id", requireUser, deleteMusicById);

// Upload a song (multipart form-data: audio, image, title, genre, description, isPolicyAccepted, artistId?)
// Upload bytes via POST /upload/presign, then finalize metadata via POST /upload/music/complete.

module.exports = router;
