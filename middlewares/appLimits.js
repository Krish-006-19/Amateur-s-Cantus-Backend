const { redisFixedWindowLimit, redisUtcDayLimit } = require('./rateLimit');

const SONG_UPLOADS_PER_DAY = Number(process.env.SONG_UPLOADS_PER_DAY || 2);

function requireRole(role) {
  return function requireRoleMiddleware(req, res, next) {
    const actual = req.userRole || req.user?.role;
    if (actual === role) return next();
    return res.status(403).json({ message: 'Forbidden' });
  };
}

const limitSongUploadsPerDay = [
  requireRole('artist'),
  redisUtcDayLimit({
    prefix: 'rl:song_upload',
    max: SONG_UPLOADS_PER_DAY,
    identifier: 'user',
    onLimitMessage: 'You can upload only 2 songs per day.',
  }),
];

const limitReportsPerDay = redisUtcDayLimit({
  prefix: 'rl:report',
  max: 3,
  identifier: 'user',
  onLimitMessage: 'You can submit only 3 reports per day.',
});

const limitCredentialChangesWeekly = redisFixedWindowLimit({
  prefix: 'rl:cred_change',
  max: 1,
  windowSeconds: 7 * 24 * 60 * 60,
  identifier: 'user',
  onLimitMessage: 'You can change profile credentials only once per week.',
});

function credentialChangeOncePerWeek(req, res, next) {
  const username = req.body && req.body.username;
  const email = req.body && req.body.email;
  const password = req.body && req.body.password;

  const isCredentialChange =
    username !== undefined ||
    email !== undefined ||
    (password !== undefined && String(password).length > 0);

  if (!isCredentialChange) return next();
  return limitCredentialChangesWeekly(req, res, next);
}

module.exports = {
  requireRole,
  SONG_UPLOADS_PER_DAY,
  limitSongUploadsPerDay,
  limitReportsPerDay,
  credentialChangeOncePerWeek,
};