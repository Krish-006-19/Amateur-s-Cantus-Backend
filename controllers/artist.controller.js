const Artist = require('../models/artist.model');

async function getAllActiveArtists(req, res) {
    try {
        const artists = await Artist.find({ status: 'active' })
            .populate('details')
            .sort({ heartsReceived: -1, reports: 1 });

        res.status(200).json(artists || []);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

async function getActiveArtistById(req, res) {
    try {
        const artist = await Artist.findOne({
            _id: req.params.id,
            status: 'active'
        }).populate('details');

        if (!artist)
            return res.status(404).json({ message: 'Artist not found' });

        res.status(200).json(artist);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

async function incrementHeartsReceived(req, res) {
    try {
        const updatedArtist = await Artist.findOneAndUpdate(
            { _id: req.params.id, status: "active" },
            { $inc: { heartsReceived: 1 } },
            { new: true }
        );

        if (!updatedArtist)
            return res.status(404).json({ message: 'Artist not found' });

        res.status(200).json(updatedArtist);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

module.exports = {
    getAllActiveArtists,
    getActiveArtistById,
    incrementHeartsReceived
};