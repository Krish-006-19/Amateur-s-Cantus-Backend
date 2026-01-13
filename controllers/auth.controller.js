const Auth = require('../models/auth.model.js');

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
    const { username, email, profileImage, password } = req.body;
    if(!username || !email || !password) {
        return res.status(400).json({ message: 'Username, email, and password are required' });
    }
    try {
        const newUser = await Auth.create({ username, email, profileImage, password });
        if(!newUser)
            return res.status(400).json({ message: 'Failed to create user' });
        res.status(201).json({ msg: 'User created successfully'});
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function updateUser(req, res) {
    const { username, email, profileImage, password } = req.body;
    if(!username || !email || !password) {
        return res.status(400).json({ message: 'Username, email, and password are required' });
    }
    try {
        const updatedUser = await Auth.findByIdAndUpdate(req.params.id, { username, email, profileImage, password }, { new: true });
        if(!updatedUser)
            return res.status(404).json({ message: 'User not found' });
        res.status(200).json({ msg: 'User updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function deleteUser(req, res) {
    try {
        const deletedUser = await Auth.findByIdAndDelete(req.params.id);
        if(!deletedUser)
            return res.status(404).json({ message: 'User not found' });
        res.status(200).json({ msg: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = {
    getAllUsers,
    createUser,
    updateUser,
    deleteUser
};