const express = require("express");
const router = express.Router();
const { optionalUser, requireUser } = require('../middlewares/auth');
const { uploadMusicFields } = require('../middlewares/multer');
const {
  getApprovedMusicList,
  getApprovedMusicById,
  createMusic,
  updateMusic,
  updateLikes,
  updatePlays
} = require("../controllers/music.controller.js");

router.get("/", getApprovedMusicList);

router.patch("/:id/like", optionalUser, updateLikes);
router.patch("/:id/play", optionalUser, updatePlays);

router.get("/:id", getApprovedMusicById);
router.patch("/:id", requireUser, updateMusic);

// Upload a song (multipart form-data: audio, image, title, genre, description, isPolicyAccepted, artistId?)
router.post("/", optionalUser, uploadMusicFields, createMusic);

module.exports = router;