const express = require("express");
const router = express.Router();
const {
    getConsumerById,
    addToPlaylist,
    removeFromPlaylist,
} = require("../controllers/consumer.controller");

router.get("/:id", getConsumerById);
router.post("/playlist/:consumerId/:musicId", addToPlaylist);
router.post("/playlist/:consumerId/dislike", removeFromPlaylist);

module.exports = router;