const Report = require("../models/report.model");
const Music = require("../models/music.model");
const Artist = require("../models/artist.model");
const Consumer = require("../models/consumer.model");

/** Get reports submitted by the current user (consumer) */
async function getMyReports(req, res) {
    try {
        const consumer = await Consumer.findOne({ details: req.user._id });
        if (!consumer) return res.status(200).json([]);

        const reports = await Report.find({ reportedBy: consumer._id })
            .populate({ path: "music", select: "title musicImage musicAudio" })
            .populate({ path: "reportedAgainst", populate: { path: "details", select: "username" } })
            .sort({ createdAt: -1 });
        res.status(200).json(reports || []);
    } catch (error) {
        res.status(500).json({ message: error.message || "Server Error" });
    }
}

/** Resolve id to Consumer doc: id can be Consumer._id or Auth _id (details) */
async function findConsumerById(id) {
    if (!id) return null;
    let consumer = await Consumer.findById(id);
    if (consumer) return consumer;
    consumer = await Consumer.findOne({ details: id });
    return consumer;
}

async function createReport(req, res) {
    const { reason, proof } = req.body;
    const { consumerId, musicId } = req.params;
    if (!consumerId || !musicId || !reason) {
        return res
            .status(400)
            .json({ message: "consumerId, musicId, and reason are required" });
    }
    try {
        const consumerDoc = await findConsumerById(consumerId);
        if (!consumerDoc) return res.status(404).json({ message: "Consumer not found" });

        // Prevent spoofing: the authenticated user must own this consumer profile.
        const isAdmin = (req.userRole || req.user?.role) === 'admin';
        if (!isAdmin && String(consumerDoc.details) !== String(req.user._id)) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const music = await Music.findById(musicId);
        if (!music) return res.status(404).json({ message: "Music not found" });

        const artist = await Artist.findById(music.uploadedBy);
        if (!artist) return res.status(404).json({ message: "Artist not found for this song" });
        const artistId = artist._id;

        // Block self-reporting: uploader cannot report their own track.
        if (!isAdmin && artist.details && String(artist.details) === String(req.user._id)) {
            return res.status(403).json({ message: 'You cannot report your own song' });
        }

        const newReport = await Report.create({
            reportedBy: consumerDoc._id,
            music: musicId,
            reportedAgainst: artistId,
            reason: String(reason).trim(),
            proof: proof != null ? String(proof) : "",
            status: "pending",
        });
        if (!newReport) {
            return res.status(400).json({ message: "Failed to create report" });
        }

        await Music.updateOne({ _id: musicId }, { $inc: { reports: 1 } });
        if (artistId) await Artist.updateOne({ _id: artistId }, { $inc: { reports: 1 } });

        res.status(201).json(newReport);
    } catch (error) {
        if (error && error.code === 11000) {
            return res.status(409).json({ message: "You already reported this song" });
        }
        res.status(500).json({ message: "Server Error" });
    }
}

module.exports = {
    createReport,
    getMyReports,
};