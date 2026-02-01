const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const Auth = require('../models/auth.model.js');
const Artist = require('../models/artist.model');
const Consumer = require('../models/consumer.model');
const Admin = require('../models/admin.model');
const Music = require('../models/music.model');
const Report = require('../models/report.model');
const { uploadOnCloudinary, deleteFromCloudinary } = require('../utilities/cloudinary');
const { hardDeleteAllMusicForArtist } = require('../utilities/cascadeDelete');

function signToken(user) {
    const secret = process.env.JWT_SECRET || 'dev-secret';
    return jwt.sign(
        { sub: user._id.toString(), role: user.role },
        secret,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
}

async function ensureProfileForUser(user) {
    if (!user || !user._id) return null;

    if (user.role === 'artist') {
        let artist = await Artist.findOne({ details: user._id });
        if (!artist) artist = await Artist.create({ details: user._id });
        return { type: 'artist', id: artist._id };
    }

    if (user.role === 'admin') {
        let admin = await Admin.findOne({ authDetails: user._id });
        if (!admin) admin = await Admin.create({ authDetails: user._id });
        return { type: 'admin', id: admin._id };
    }

    // default consumer
    let consumer = await Consumer.findOne({ details: user._id });
    if (!consumer) consumer = await Consumer.create({ details: user._id });
    return { type: 'consumer', id: consumer._id };
}

async function ensureProfilesForUser(user) {
    if (!user || !user._id) return {};

    const profiles = {};

    // Artists can also act as consumers (playlist/report)
    if (user.role === 'artist') {
        let artist = await Artist.findOne({ details: user._id });
        if (!artist) artist = await Artist.create({ details: user._id });
        profiles.artist = artist._id;

        let consumer = await Consumer.findOne({ details: user._id });
        if (!consumer) consumer = await Consumer.create({ details: user._id });
        profiles.consumer = consumer._id;
        return profiles;
    }

    if (user.role === 'admin') {
        let admin = await Admin.findOne({ authDetails: user._id });
        if (!admin) admin = await Admin.create({ authDetails: user._id });
        profiles.admin = admin._id;
        return profiles;
    }

    // default consumer
    let consumer = await Consumer.findOne({ details: user._id });
    if (!consumer) consumer = await Consumer.create({ details: user._id });
    profiles.consumer = consumer._id;
    return profiles;
}

async function getAllUsers(req, res) {
    try {
        const allUsers = await Auth.find();
        if(allUsers.length === 0)
            return res.status(404).json({ message: 'No users found' });
        res.status(200).json(allUsers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function createUser(req, res) {
    const { username, email, profileImage, password, role } = req.body;
    if(!username || !email || !password) {
        return res.status(400).json({ message: 'Username, email, and password are required' });
    }
    try {
        const hashed = await bcrypt.hash(password, 10);
        const newUser = await Auth.create({ username, email, profileImage, password: hashed, role: role || 'consumer' });
        if(!newUser)
            return res.status(400).json({ message: 'Failed to create user' });
        res.status(201).json({ msg: 'User created successfully'});
    } catch (error) {
        if (error && error.code === 11000) {
            const keys = Object.keys(error.keyPattern || error.keyValue || {});
            const field = keys[0] || 'field';
            return res.status(409).json({ message: `${field} already exists` });
        }
        if (error && error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        return res.status(500).json({ message: error.message });
    }
}

async function updateUser(req, res) {
    try {
        const update = {};
        const { username, email, profileImage, password, role, status } = req.body;
        if (username !== undefined) update.username = username;
        if (email !== undefined) update.email = email;
        if (profileImage !== undefined) update.profileImage = profileImage;
        if (role !== undefined) update.role = role;
        if (status !== undefined) update.status = status;
        if (password !== undefined) update.password = await bcrypt.hash(password, 10);

        const updatedUser = await Auth.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
        if(!updatedUser)
            return res.status(404).json({ message: 'User not found' });
        res.status(200).json({ msg: 'User updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function register(req, res) {
    const username = req.body && req.body.username ? String(req.body.username).trim() : '';
    const email = req.body && req.body.email ? String(req.body.email).toLowerCase().trim() : '';
    const password = req.body && req.body.password ? req.body.password : '';
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Username, email, and password are required' });
    }

    let profileImageUrl = null;
    let profileImagePublicId = null;
    if (req.file && req.file.path) {
        try {
            const result = await uploadOnCloudinary(req.file.path, { resource_type: 'image' });
            if (result) {
                profileImageUrl = result.url;
                profileImagePublicId = result.public_id;
            }
        } catch (_) {
            try { fs.unlinkSync(req.file.path); } catch (__) {}
        }
    }

    try {
        const role = req.body.role;
        const normalizedRole = ['artist', 'admin', 'consumer'].includes(role) ? role : 'consumer';
        const hashed = await bcrypt.hash(password, 10);
        const user = await Auth.create({
            username,
            email,
            password: hashed,
            role: normalizedRole,
            profileImage: profileImageUrl,
            profileImagePublicId: profileImagePublicId || undefined,
        });

        const profiles = await ensureProfilesForUser(user);
        const profile = await ensureProfileForUser(user);

        const token = signToken(user);
        res.status(201).json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                status: user.status,
                profileImage: user.profileImage,
                profile,
                profiles,
            },
        });
    } catch (error) {
        if (error && error.code === 11000) {
            const keys = Object.keys(error.keyPattern || error.keyValue || {});
            const field = keys[0] || 'field';
            return res.status(409).json({ message: `${field} already exists` });
        }
        if (error && error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        return res.status(500).json({ message: error.message });
    }
}

async function login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    try {
        const user = await Auth.findOne({ email: String(email).toLowerCase().trim() });
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });
        if (user.status !== 'active') return res.status(403).json({ message: 'Account is not active' });

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

        const profiles = await ensureProfilesForUser(user);
        const profile = await ensureProfileForUser(user);

        const token = signToken(user);
        res.status(200).json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                status: user.status,
                profileImage: user.profileImage,
                profile,
                profiles,
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

function toSafeUser(user) {
    if (!user) return null;
    const u = user.toObject ? user.toObject() : { ...user };
    delete u.password;
    return u;
}

async function getMe(req, res) {
    try {
        const user = await Auth.findById(req.user._id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        const profiles = await ensureProfilesForUser(req.user);
        const profile = await ensureProfileForUser(req.user);
        res.status(200).json({
            user: toSafeUser(user),
            profile,
            profiles,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function updateMe(req, res) {
    try {
        const userId = req.user._id;
        const update = {};
        const username = req.body && req.body.username;
        const email = req.body && req.body.email;
        const password = req.body && req.body.password;
        if (username !== undefined) update.username = String(username).trim();
        if (email !== undefined) update.email = String(email).toLowerCase().trim();
        if (password !== undefined && password) update.password = await bcrypt.hash(password, 10);

        if (req.file && req.file.path) {
            const current = await Auth.findById(userId).select('profileImagePublicId');
            if (current && current.profileImagePublicId) {
                try {
                    await deleteFromCloudinary(current.profileImagePublicId, 'image');
                } catch (_) {}
            }
            const result = await uploadOnCloudinary(req.file.path, { resource_type: 'image' });
            if (result) {
                update.profileImage = result.url;
                update.profileImagePublicId = result.public_id;
            }
            try { fs.unlinkSync(req.file.path); } catch (_) {}
        }

        const updatedUser = await Auth.findByIdAndUpdate(userId, update, { new: true, runValidators: true }).select('-password');
        if (!updatedUser) return res.status(404).json({ message: 'User not found' });
        const profiles = await ensureProfilesForUser(updatedUser);
        const profile = await ensureProfileForUser(updatedUser);
        res.status(200).json({
            user: toSafeUser(updatedUser),
            profile,
            profiles,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function deleteMe(req, res) {
    try {
        const userId = req.user._id;
        const user = await Auth.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const consumer = await Consumer.findOne({ details: userId });
        const artist = await Artist.findOne({ details: userId });
        const admin = await Admin.findOne({ authDetails: userId });

        if (consumer) {
            await Music.updateMany({}, { $pull: { likedBy: consumer._id } });
            await Report.deleteMany({ reportedBy: consumer._id });
            await Consumer.findByIdAndDelete(consumer._id);
        }
        if (artist) {
            // Cascade delete: remove all songs + Cloudinary assets for this artist
            await hardDeleteAllMusicForArtist(artist._id);
            await Artist.findByIdAndDelete(artist._id);
        }
        if (admin) await Admin.findByIdAndDelete(admin._id);

        if (user.profileImagePublicId) {
            try {
                await deleteFromCloudinary(user.profileImagePublicId, 'image');
            } catch (_) {}
        }
        await Auth.findByIdAndDelete(userId);

        res.status(200).json({ message: 'Account deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function deleteUser(req, res) {
    try {
        const userId = req.params.id;
        const user = await Auth.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const consumer = await Consumer.findOne({ details: userId });
        const artist = await Artist.findOne({ details: userId });
        const admin = await Admin.findOne({ authDetails: userId });

        if (consumer) {
            await Music.updateMany({}, { $pull: { likedBy: consumer._id } });
            await Report.deleteMany({ reportedBy: consumer._id });
            await Consumer.findByIdAndDelete(consumer._id);
        }

        if (artist) {
            await hardDeleteAllMusicForArtist(artist._id);
            await Artist.findByIdAndDelete(artist._id);
        }

        if (admin) {
            await Admin.findByIdAndDelete(admin._id);
        }

        if (user.profileImagePublicId) {
            try {
                await deleteFromCloudinary(user.profileImagePublicId, 'image');
            } catch (_) {}
        }

        await Auth.findByIdAndDelete(userId);
        res.status(200).json({ msg: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = {
    getAllUsers,
    createUser,
    updateUser,
    deleteUser,
    register,
    login,
    getMe,
    updateMe,
    deleteMe,
};