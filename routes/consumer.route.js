const express = require("express");
const router = express.Router();
const {
    getConsumerById,
    addToPlaylist,
    removeFromPlaylist,
} = require("../controllers/consumer.controller");

const { requireAuth } = require("../clerk");

router.get("/:id", requireAuth, getConsumerById);
router.post("/playlist/:consumerId/:musicId", requireAuth, addToPlaylist);
router.post("/playlist/:consumerId/dislike", requireAuth, removeFromPlaylist);

module.exports = router;