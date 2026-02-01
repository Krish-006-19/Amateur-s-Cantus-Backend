const { ensureRedisConnected } = require('../utilities/redis');

// In-memory fallback (used if Redis is down/unconfigured).
// This is per-process only, but ensures limits still work in dev/single-instance deployments.
const memoryStore = new Map();

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function memoryGetOrInit(key, resetAtSeconds) {
  const now = nowSeconds();
  const existing = memoryStore.get(key);
  if (!existing || !existing.resetAt || existing.resetAt <= now) {
    const entry = { count: 0, resetAt: resetAtSeconds };
    memoryStore.set(key, entry);
    return entry;
  }
  return existing;
}

function memoryIncr(key, windowSeconds) {
  const now = nowSeconds();
  const resetAt = now + Math.max(1, Number(windowSeconds || 1));
  const entry = memoryGetOrInit(key, resetAt);
  entry.count += 1;
  return { count: entry.count, ttl: Math.max(0, entry.resetAt - now) };
}

function memoryIncrUntil(key, resetAtSeconds) {
  const now = nowSeconds();
  const entry = memoryGetOrInit(key, resetAtSeconds);
  entry.count += 1;
  return { count: entry.count, ttl: Math.max(0, entry.resetAt - now) };
}

function getUtcDateKey(date = new Date()) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function secondsUntilEndOfUtcDay(date = new Date()) {
  const end = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  return Math.max(1, Math.floor((end.getTime() - date.getTime()) / 1000));
}

function getIdentifierFromReq(req, { identifier = 'user' } = {}) {
  if (identifier === 'ip') {
    return (
      req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req.ip ||
      'unknown'
    );
  }

  // default: user
  const userId = req?.user?._id;
  return userId ? String(userId) : 'anonymous';
}

function redisFixedWindowLimit(options) {
  const {
    prefix,
    max,
    windowSeconds,
    identifier = 'user',
    keySuffix,
    keySuffixFn,
    onLimitMessage,
  } = options;

  if (!prefix) throw new Error('rateLimit: prefix is required');
  if (!max || max <= 0) throw new Error('rateLimit: max must be > 0');

  return async function rateLimitMiddleware(req, res, next) {
    const redis = await ensureRedisConnected();

    const id = getIdentifierFromReq(req, { identifier });

    const suffix =
      typeof keySuffixFn === 'function'
        ? keySuffixFn(req)
        : keySuffix || '';

    const key = suffix ? `${prefix}:${id}:${suffix}` : `${prefix}:${id}`;

    // Prefer Redis (shared), fallback to memory (local) if Redis is unavailable.
    if (!redis) {
      const { count, ttl } = memoryIncr(key, windowSeconds);
      if (count > max) {
        if (ttl >= 0) res.setHeader('Retry-After', String(ttl));
        return res.status(429).json({
          message:
            typeof onLimitMessage === 'function'
              ? onLimitMessage(req)
              : onLimitMessage || 'Too many requests',
        });
      }
      return next();
    }

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, Number(windowSeconds));
      }

      if (count > max) {
        const ttl = await redis.ttl(key).catch(() => null);
        if (ttl != null && ttl >= 0) res.setHeader('Retry-After', String(ttl));
        return res.status(429).json({
          message:
            typeof onLimitMessage === 'function'
              ? onLimitMessage(req)
              : onLimitMessage || 'Too many requests',
        });
      }

      return next();
    } catch (_) {
      // If Redis errors, fallback to memory rather than failing open.
      const { count, ttl } = memoryIncr(key, windowSeconds);
      if (count > max) {
        if (ttl >= 0) res.setHeader('Retry-After', String(ttl));
        return res.status(429).json({
          message:
            typeof onLimitMessage === 'function'
              ? onLimitMessage(req)
              : onLimitMessage || 'Too many requests',
        });
      }
      return next();
    }
  };
}

// Calendar-day limiter (UTC) implemented as a custom middleware so TTL matches end-of-day.
function redisUtcDayLimit({ prefix, max, identifier = 'user', onLimitMessage }) {
  if (!prefix) throw new Error('rateLimit: prefix is required');
  if (!max || max <= 0) throw new Error('rateLimit: max must be > 0');

  return async function utcDayLimitMiddleware(req, res, next) {
    const redis = await ensureRedisConnected();

    const id = getIdentifierFromReq(req, { identifier });
    const dayKey = getUtcDateKey(new Date());
    const key = `${prefix}:${id}:${dayKey}`;

    const resetAtSeconds = nowSeconds() + secondsUntilEndOfUtcDay(new Date()) + 60;

    if (!redis) {
      const { count, ttl } = memoryIncrUntil(key, resetAtSeconds);
      if (count > max) {
        if (ttl >= 0) res.setHeader('Retry-After', String(ttl));
        return res.status(429).json({
          message:
            typeof onLimitMessage === 'function'
              ? onLimitMessage(req)
              : onLimitMessage || 'Too many requests',
        });
      }
      return next();
    }

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, secondsUntilEndOfUtcDay(new Date()) + 60);
      }

      if (count > max) {
        const ttl = await redis.ttl(key).catch(() => null);
        if (ttl != null && ttl >= 0) res.setHeader('Retry-After', String(ttl));
        return res.status(429).json({
          message:
            typeof onLimitMessage === 'function'
              ? onLimitMessage(req)
              : onLimitMessage || 'Too many requests',
        });
      }

      return next();
    } catch (_) {
      // If Redis errors, fallback to memory rather than failing open.
      const { count, ttl } = memoryIncrUntil(key, resetAtSeconds);
      if (count > max) {
        if (ttl >= 0) res.setHeader('Retry-After', String(ttl));
        return res.status(429).json({
          message:
            typeof onLimitMessage === 'function'
              ? onLimitMessage(req)
              : onLimitMessage || 'Too many requests',
        });
      }
      return next();
    }
  };
}

module.exports = {
  redisFixedWindowLimit,
  redisUtcDayLimit,
};