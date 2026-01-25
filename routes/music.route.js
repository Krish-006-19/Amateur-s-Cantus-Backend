const express = require("express");
const router = express.Router();
const {
  getApprovedMusicList,
  getApprovedMusicById,
  createMusic,
  updateMusic,
  updateLikes,
  updatePlays
} = require("../controllers/music.controller.js");

router.get("/", getApprovedMusicList);

router.patch("/:id/like", updateLikes);
router.patch("/:id/play", updatePlays);

router.get("/:id", getApprovedMusicById);
router.patch("/:id", updateMusic);

router.post("/", createMusic);

module.exports = router;