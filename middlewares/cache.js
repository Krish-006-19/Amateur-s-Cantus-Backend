const { ensureRedisConnected } = require('../utilities/redis');

function defaultKeyFromReq(req) {
  // Include method + originalUrl to avoid collisions.
  return `cache:${req.method}:${req.originalUrl}`;
}

function cacheJson(options = {}) {
  const {
    ttlSeconds = 60,
    key,
    keyFn,
    shouldCache = (req, res) => req.method === 'GET' && res.statusCode === 200,
  } = options;

  return async function cacheJsonMiddleware(req, res, next) {
    if (req.method !== 'GET') return next();

    const redis = await ensureRedisConnected();
    if (!redis) return next();

    const cacheKey =
      typeof keyFn === 'function'
        ? keyFn(req)
        : typeof key === 'function'
          ? key(req)
          : key || defaultKeyFromReq(req);

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).send(cached);
      }
    } catch (_) {
      // ignore redis read failures
    }

    res.setHeader('X-Cache', 'MISS');

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    async function store(body) {
      try {
        if (!shouldCache(req, res)) return;
        const payload = typeof body === 'string' ? body : JSON.stringify(body);
        await redis.set(cacheKey, payload, { EX: Number(ttlSeconds) });
      } catch (_) {
        // ignore redis write failures
      }
    }

    res.json = (body) => {
      void store(body);
      return originalJson(body);
    };

    res.send = (body) => {
      void store(body);
      return originalSend(body);
    };

    return next();
  };
}

async function deleteCacheKeys(keys) {
  if (!Array.isArray(keys) || keys.length === 0) return;
  const redis = await ensureRedisConnected();
  if (!redis) return;

  try {
    await redis.del(keys);
  } catch (_) {
    // ignore
  }
}

module.exports = {
  cacheJson,
  deleteCacheKeys,
};