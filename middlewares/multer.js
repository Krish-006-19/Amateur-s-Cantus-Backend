const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Receives multipart audio/image from frontend; saves to disk. Controller then uploads to Cloudinary and saves URLs to DB.
const MAX_AUDIO_BYTES = 6 * 1024 * 1024; // 6MB
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
try {
  fs.mkdirSync(uploadDir, { recursive: true });
} catch (_) {}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const PROFILE_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB

function fileFilter(req, file, cb) {
  if (file.fieldname === 'audio') {
    const ok = file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/mp3' || file.mimetype === 'audio/mpeg3';
    return cb(ok ? null : new Error('Only MP3 audio is allowed'), ok);
  }
  if (file.fieldname === 'image' || file.fieldname === 'profileImage') {
    const ok = file.mimetype === 'image/png' || file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg';
    return cb(ok ? null : new Error('Only PNG/JPG images are allowed'), ok);
  }
  return cb(new Error('Unexpected upload field'), false);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: Math.max(MAX_AUDIO_BYTES, MAX_IMAGE_BYTES),
    files: 2,
  },
});

const uploadMusicFields = upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'image', maxCount: 1 },
]);

const uploadProfileImage = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.fieldname !== 'profileImage') return cb(new Error('Unexpected field'), false);
    const ok = file.mimetype === 'image/png' || file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg';
    return cb(ok ? null : new Error('Only PNG/JPG images allowed'), ok);
  },
  limits: { fileSize: PROFILE_IMAGE_BYTES },
}).single('profileImage');

module.exports = { upload, uploadMusicFields, uploadProfileImage, MAX_AUDIO_BYTES, MAX_IMAGE_BYTES };