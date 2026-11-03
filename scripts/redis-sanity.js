// Usage:
//   node scripts/redis-sanity.js
// Requires REDIS_URL in environment (or backend/.env)

require('dotenv').config({ override: true });

const { ensureRedisConnected } = require('../utilities/redis');

async function main() {
  const redis = await ensureRedisConnected();
  if (!redis) {
    console.log('redis-sanity: REDIS_URL not configured (redis client is null)');
    return;
  }

  // Prefer SCAN over KEYS to avoid blocking Redis.
  let cursor = '0';
  const keys = [];

  do {
    // node-redis v4: scan(cursor, { MATCH, COUNT })
    const reply = await redis.scan(cursor, { MATCH: '*', COUNT: 200 });
    cursor = reply.cursor;
    keys.push(...reply.keys);

    // Keep output bounded
    if (keys.length >= 500) break;
  } while (cursor !== '0');

  keys.sort();

  const interesting = keys.filter((k) =>
    k.startsWith('cache:music') || k.startsWith('cache:artist') || k.startsWith('rate:') || k.startsWith('cache:'),
  );

  async function ttlFor(key) {
    try {
      return await redis.ttl(key);
    } catch {
      return null;
    }
  }

  const sample = interesting.slice(0, 30);
  const sampleWithTtl = [];
  for (const k of sample) {
    sampleWithTtl.push({ key: k, ttlSeconds: await ttlFor(k) });
  }

  console.log(
    JSON.stringify(
      {
        totalKeysScanned: keys.length,
        interestingKeysCount: interesting.length,
        sampleKeys: sampleWithTtl,
      },
      null,
      2,
    ),
  );

  await redis.quit();
}

main().catch((error) => {
  console.error('redis-sanity failed:', error?.message || error);
  process.exit(1);
});
