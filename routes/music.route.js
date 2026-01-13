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

const { requireAuth } = require("../clerk");

router.get("/", requireAuth, getApprovedMusicList);

router.patch("/:id/like", requireAuth, updateLikes);
router.patch("/:id/play", requireAuth, updatePlays);

router.get("/:id", requireAuth, getApprovedMusicById);
router.patch("/:id", requireAuth, updateMusic);

router.post("/", requireAuth, createMusic);

module.exports = router;