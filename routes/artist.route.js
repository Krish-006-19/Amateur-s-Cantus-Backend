const express = require('express');
const router = express.Router();
const { requireUser } = require('../middlewares/auth');
const { cacheJson } = require('../middlewares/cache');
const { artistListKey, artistDetailKey } = require('../utilities/cacheKeys');
const {
    getAllActiveArtists,
    getActiveArtistById,
    incrementHeartsReceived,
} = require('../controllers/artist.controller.js');


router.get(
    '/',
    cacheJson({ key: artistListKey(), ttlSeconds: Number(process.env.CACHE_TTL_ARTIST_LIST_SECONDS || 120) }),
    getAllActiveArtists
);
router.get(
    '/:id',
    cacheJson({ key: (req) => artistDetailKey(req.params.id), ttlSeconds: Number(process.env.CACHE_TTL_ARTIST_DETAIL_SECONDS || 120) }),
    getActiveArtistById
);
router.patch('/:id', requireUser, incrementHeartsReceived);

module.exports = router;