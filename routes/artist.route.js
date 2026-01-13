const express = require('express');
const router = express.Router();
const {
    getAllActiveArtists,
    getActiveArtistById,
    incrementHeartsReceived,
} = require('../controllers/artist.controller.js');

const { requireAuth } = require('../clerk');

router.get('/', requireAuth, getAllActiveArtists);
router.get('/:id', requireAuth, getActiveArtistById);
router.patch('/:id', requireAuth, incrementHeartsReceived);

module.exports = router;