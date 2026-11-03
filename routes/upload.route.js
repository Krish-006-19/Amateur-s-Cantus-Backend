const express = require('express');
const router = express.Router();

const { requireUser } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/appLimits');
const { redisFixedWindowLimit } = require('../middlewares/rateLimit');
const { presign, completeMusic } = require('../controllers/upload.controller');

// Flow: browser POST /upload/presign (JSON) -> browser PUTs the file straight to S3 ->
// browser POST /upload/music/complete (JSON keys + metadata) -> keys and public URLs stored in MongoDB.
// Profile pictures use presign (kind: "profileImage") then PUT /api/auth/me/profile-image.
const limitPresign = redisFixedWindowLimit({
  prefix: 'rl:presign',
  max: Number(process.env.PRESIGN_PER_HOUR || 20),
  windowSeconds: 60 * 60,
  identifier: 'user',
  onLimitMessage: 'Too many upload requests. Try again later.',
});

router.post('/presign', requireUser, limitPresign, presign);
router.post('/music/complete', requireUser, requireRole('artist'), completeMusic);

module.exports = router;
