const Consumer = require("../models/consumer.model");

async function getConsumerById(req, res) {
    try {
        const consumer = await Consumer.findById(req.params.id).populate("playlist");
        if (!consumer) {
            return res.status(404).json({ message: "Consumer not found" });
        }
        res.status(200).json(consumer);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
}

async function addToPlaylist(req, res) {
    try {
        const consumer = await Consumer.findByIdAndUpdate(
            req.params.consumerId,
            {
                $addToSet: { playlist: req.params.musicId },
            },
            { new: true, runValidators: true }
        );
        if (!consumer)
            return res.status(404).json({ message: "Consumer not found" });
        res.status(201).json(consumer);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
}

async function removeFromPlaylist(req, res) {
    try {
        const consumer = await Consumer.findByIdAndUpdate(
            req.params.consumerId,
            {
                $pull: { playlist: req.params.musicId },
            },
            { new: true, runValidators: true }
        );  
        if (!consumer)
            return res.status(404).json({ message: "Consumer not found" });
        res.status(201).json(consumer);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
}

module.exports = {
    getConsumerById,
    addToPlaylist,
    removeFromPlaylist,
};