const express = require('express');
const router = express.Router();

const { optionalUser } = require('../middlewares/auth');
const { uploadMusicFields } = require('../middlewares/multer');
const { createMusic } = require('../controllers/music.controller');

// Flow: Frontend sends multipart form-data → Multer saves audio/image to disk →
// createMusic uploads each file to Cloudinary → Cloudinary URLs stored in DB (musicAudio, musicImage) →
// UI (Explore, SongPage, GlobalPlayer) displays images and plays audio from those URLs.
// Expects: audio (required), image (optional), title, genre, description, isPolicyAccepted; artistId or auth.
router.post('/', optionalUser, uploadMusicFields, createMusic);

module.exports = router;
