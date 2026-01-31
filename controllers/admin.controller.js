const Report = require('../models/report.model');
const Artist = require('../models/artist.model');
const Music = require('../models/music.model');
const Auth = require('../models/auth.model');
const bcrypt = require('bcrypt');

const STRIKES_TO_DEACTIVATE = Number(process.env.STRIKES_TO_DEACTIVATE || 5);

async function getPendingReports(req, res) {
    try {
        const reports = await Report.find({ status: 'pending' })
            .populate({ path: 'reportedBy', populate: { path: 'details', select: 'username email' } })
            .populate({ path: 'reportedAgainst', populate: { path: 'details', select: 'username profileImage' } })
            .populate({ path: 'music' })
            .sort({ createdAt: -1 });

        res.status(200).json(reports);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

/** All reports (all statuses) for admin */
async function getAllReports(req, res) {
    try {
        const reports = await Report.find({})
            .populate({ path: 'reportedBy', populate: { path: 'details', select: 'username email' } })
            .populate({ path: 'reportedAgainst', populate: { path: 'details', select: 'username profileImage' } })
            .populate({ path: 'music' })
            .sort({ createdAt: -1 });

        res.status(200).json(reports);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

async function getPendingReportById(req, res) {
    try {
        const report = await Report.findOne({ _id: req.params.id, status: 'pending' })
            .populate({ path: 'reportedBy', populate: { path: 'details', select: 'username email' } })
            .populate({ path: 'reportedAgainst', populate: { path: 'details', select: 'username profileImage' } })
            .populate({ path: 'music' });

        if (!report) return res.status(404).json({ message: 'Report not found' });
        res.status(200).json(report);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

async function dismissReport(req, res) {
    try {
        const report = await Report.findOneAndUpdate(
            { _id: req.params.id, status: 'pending' },
            { status: 'dismissed' },
            { new: true }
        );

        if (!report) return res.status(404).json({ message: 'Report not found' });
        res.status(200).json({ message: 'Report dismissed', report });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

async function takeActionOnReport(req, res) {
    // action: 'remove_music' | 'strike' | 'remove_and_strike' | 'flag_for_edit'
    const action = (req.body && req.body.action) || 'remove_and_strike';

    if (!['remove_music', 'strike', 'remove_and_strike', 'flag_for_edit'].includes(action)) {
        return res.status(400).json({ message: 'Invalid action' });
    }

    try {
        const report = await Report.findOne({ _id: req.params.id, status: 'pending' });
        if (!report) return res.status(404).json({ message: 'Report not found' });

        const music = await Music.findById(report.music);
        if (!music) return res.status(404).json({ message: 'Music not found' });

        const artist = report.reportedAgainst ? await Artist.findById(report.reportedAgainst) : null;

        if (action === 'flag_for_edit') {
            music.flaggedForEdit = true;
            await music.save();
            report.status = 'approved';
            await report.save();
            return res.status(200).json({
                message: 'Report approved; artist must edit song details',
                report,
                music,
            });
        }

        if (action === 'remove_music' || action === 'remove_and_strike') {
            music.status = 'removed';
            await music.save();
        }

        if (artist && (action === 'strike' || action === 'remove_and_strike')) {
            artist.policyStrikes = (artist.policyStrikes || 0) + 1;
            if (artist.policyStrikes >= STRIKES_TO_DEACTIVATE) {
                artist.status = 'deactivated';
                await Auth.updateOne({ _id: artist.details }, { $set: { status: 'deactivated' } });
            }
            await artist.save();
        }

        report.status = 'reviewed';
        await report.save();

        res.status(200).json({
            message: 'Report reviewed',
            report,
            music,
            artist,
            strikesToDeactivate: STRIKES_TO_DEACTIVATE,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

async function getArtistsWithReports(req, res) {
    try {
        const artists = await Artist.find({ reports: { $gte: 1 } })
            .populate({ path: 'details', select: 'username profileImage status' })
            .sort({ reports: -1, policyStrikes: -1, heartsReceived: -1 });

        res.status(200).json(artists || []);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

async function deactivateArtistById(req, res) {
    try {
        const artist = await Artist.findById(req.params.id);
        if (!artist) return res.status(404).json({ message: 'Artist not found' });

        artist.status = 'deactivated';
        await artist.save();
        await Auth.updateOne({ _id: artist.details }, { $set: { status: 'deactivated' } });

        res.status(200).json({ message: 'Artist deactivated', artist });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

async function getMusicWithReports(req, res) {
    try {
        const music = await Music.find({ reports: { $gte: 1 } })
            .populate({ path: 'uploadedBy', populate: { path: 'details', select: 'username profileImage' } })
            .sort({ reports: -1, createdAt: -1 });

        res.status(200).json(music || []);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

async function removeMusicById(req, res) {
    try {
        const music = await Music.findById(req.params.id);
        if (!music) return res.status(404).json({ message: 'Music not found' });

        music.status = 'removed';
        await music.save();

        res.status(200).json({ message: 'Music removed', music });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

// Admin: list users (emails etc) WITHOUT returning password hashes
async function getAllUsersForAdmin(req, res) {
    try {
        const users = await Auth.find({})
            .select('_id username email role status createdAt updatedAt')
            .sort({ createdAt: -1 });

        res.status(200).json(users || []);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

// Admin: reset user password (cannot read existing password)
async function resetUserPassword(req, res) {
    const password = req.body && req.body.password ? String(req.body.password) : '';
    if (!password || password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    try {
        const hashed = await bcrypt.hash(password, 10);
        const user = await Auth.findByIdAndUpdate(
            req.params.id,
            { $set: { password: hashed } },
            { new: true }
        ).select('_id username email role status createdAt updatedAt');

        if (!user) return res.status(404).json({ message: 'User not found' });
        res.status(200).json({ message: 'Password reset', user });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

module.exports = {
    getPendingReports,
    getAllReports,
    getPendingReportById,
    dismissReport,
    takeActionOnReport,
    getArtistsWithReports,
    deactivateArtistById,
    getMusicWithReports,
    removeMusicById,
    getAllUsersForAdmin,
    resetUserPassword,
};