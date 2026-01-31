const Consumer = require("../models/consumer.model");

/** Resolve id to Consumer doc: id can be Consumer._id or Auth _id (details) */
async function findConsumerById(id) {
    if (!id) return null;
    let consumer = await Consumer.findById(id);
    if (consumer) return consumer;
    consumer = await Consumer.findOne({ details: id });
    return consumer;
}

async function getConsumerById(req, res) {
    try {
        let consumer = await findConsumerById(req.params.id);
        if (!consumer) return res.status(404).json({ message: "Consumer not found" });

        consumer = await Consumer.findById(consumer._id).populate({
            path: "playlist",
            populate: {
                path: "uploadedBy",
                populate: { path: "details", select: "username profileImage" },
            },
        });
        res.status(200).json(consumer);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
}

async function addToPlaylist(req, res) {
    try {
        const consumerDoc = await findConsumerById(req.params.consumerId);
        if (!consumerDoc) return res.status(404).json({ message: "Consumer not found" });

        const consumer = await Consumer.findByIdAndUpdate(
            consumerDoc._id,
            { $addToSet: { playlist: req.params.musicId } },
            { new: true, runValidators: true }
        );
        res.status(201).json(consumer);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
}

async function removeFromPlaylist(req, res) {
    try {
        const consumerDoc = await findConsumerById(req.params.consumerId);
        if (!consumerDoc) return res.status(404).json({ message: "Consumer not found" });

        const consumer = await Consumer.findByIdAndUpdate(
            consumerDoc._id,
            { $pull: { playlist: req.params.musicId } },
            { new: true, runValidators: true }
        );
        res.status(200).json(consumer);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
}

module.exports = {
    getConsumerById,
    addToPlaylist,
    removeFromPlaylist,
};