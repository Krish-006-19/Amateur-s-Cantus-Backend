const express = require('express');
const router = express.Router();
const { requireUser } = require('../middlewares/auth');
const {
    getAllActiveArtists,
    getActiveArtistById,
    incrementHeartsReceived,
} = require('../controllers/artist.controller.js');


router.get('/', getAllActiveArtists);
router.get('/:id', getActiveArtistById);
router.patch('/:id', requireUser, incrementHeartsReceived);

module.exports = router;