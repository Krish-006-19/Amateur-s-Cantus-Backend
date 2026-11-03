const express = require("express");
const router = express.Router();
const { requireUser } = require('../middlewares/auth');
const {
    getConsumerById,
    addToPlaylist,
    removeFromPlaylist,
} = require("../controllers/consumer.controller");

router.get("/:id", getConsumerById);
router.post("/playlist/:consumerId/:musicId", requireUser, addToPlaylist);
router.delete("/playlist/:consumerId/:musicId", requireUser, removeFromPlaylist);
// Backward compat
router.post("/playlist/:consumerId/dislike", requireUser, removeFromPlaylist);

module.exports = router;