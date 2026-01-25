const express = require('express');
const router = express.Router();
const {
    getAllActiveArtists,
    getActiveArtistById,
    incrementHeartsReceived,
} = require('../controllers/artist.controller.js');


router.get('/', getAllActiveArtists);
router.get('/:id', getActiveArtistById);
router.patch('/:id', incrementHeartsReceived);

module.exports = router;