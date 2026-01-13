const Report = require('../models/report.model');
const Artist = require('../models/artist.model');
const Music = require('../models/music.model');
const User = require('../models/user.model');

async function getPendingReports(req, res) {
    try {
        await requireAdmin(req);

        const reports = await Report.find({ status: 'pending' });
        if (!reports.length)
            return res.status(404).json({ message: 'No pending reports found' });

        res.status(200).json(reports);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message });
    }
}

async function getPendingReportById(req, res) {
    try {
        await requireAdmin(req);

        const report = await Report.findOne({
            _id: req.params.id,
            status: 'pending'
        });

        if (!report)
            return res.status(404).json({ message: 'Report not found' });

        res.status(200).json(report);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message });
    }
}

async function deleteReportFailure(req, res) {
    try {
        await requireAdmin(req);

        const report = await Report.findByIdAndDelete(req.params.id);
        if (!report)
            return res.status(404).json({ message: 'Report not found' });

        res.status(200).json({ message: 'Report deleted successfully' });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message });
    }
}

async function getArtistsWithReports(req, res) {
    try {
        await requireAdmin(req);

        const artists = await Artist.find({ reports: { $gte: 1 } });
        if (!artists.length)
            return res.status(404).json({ message: 'No artists with reports found' });

        res.status(200).json(artists);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message });
    }
}

async function deleteArtistById(req, res) {
    try {
        await requireAdmin(req);

        const artist = await Artist.findOneAndDelete({
            _id: req.params.id,
            reports: { $gte: 3 }
        });

        if (!artist)
            return res.status(404).json({ message: 'Artist not found or not eligible' });

        res.status(200).json({ message: 'Artist deleted successfully' });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message });
    }
}

async function getMusicWithReports(req, res) {
    try {
        await requireAdmin(req);

        const music = await Music.find({ reports: { $gte: 1 } });
        if (!music.length)
            return res.status(404).json({ message: 'No music with reports found' });

        res.status(200).json(music);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message });
    }
}

async function deleteMusicById(req, res) {
    try {
        await requireAdmin(req);

        const music = await Music.findOneAndDelete({
            _id: req.params.id,
            reports: { $gte: 3 }
        });

        if (!music)
            return res.status(404).json({ message: 'Music not found or not eligible' });

        res.status(200).json({ message: 'Music deleted successfully' });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message });
    }
}

async function updateLikes(req, res) {
    try {
        await requireUser(req);

        const music = await Music.findOneAndUpdate(
            { _id: req.params.id, status: "approved" },
            { $inc: { likes: 1 } },
            { new: true }
        );

        res.status(200).json(music);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message });
    }
}

async function updatePlays(req, res) {
    try {
        await requireUser(req);

        const music = await Music.findOneAndUpdate(
            { _id: req.params.id, status: "approved" },
            { $inc: { plays: 1 } },
            { new: true }
        );

        res.status(200).json(music);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message });
    }
}

async function updateReports(req, res) {
    try {
        await requireUser(req);

        const music = await Music.findOneAndUpdate(
            { _id: req.params.id, status: "approved" },
            { $inc: { reports: 1 } },
            { new: true }
        );

        res.status(200).json(music);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message });
    }
}

async function reportArtist(req, res) {
    try {
        await requireUser(req);

        const artist = await Artist.findByIdAndUpdate(
            req.params.id,
            { $inc: { reports: 1 } },
            { new: true }
        );

        if (!artist)
            return res.status(404).json({ message: 'Artist not found' });

        res.status(200).json(artist);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message });
    }
}
module.exports = {
    getPendingReports,
    getPendingReportById,
    deleteReportFailure,
    getArtistsWithReports,
    deleteArtistById,
    getMusicWithReports,
    deleteMusicById,
    updateReports,
    reportArtist
};