const { createClient } = require('redis');

let client;
let connectPromise;

function getRedisClient() {
  if (client) return client;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  // If REDIS_URL starts with rediss:// we enable TLS; for redis:// we do not.
  let tls = false;
  let servername;
  try {
    const parsed = new URL(url);
    tls = parsed.protocol === 'rediss:';
    servername = parsed.hostname;
  } catch {
    // ignore parse errors; redis client will throw on connect
  }

  client = createClient({
    url,
    socket: {
      ...(tls ? { tls: true, servername } : {}),
      connectTimeout: 7000,

      // Avoid endless noisy loops on bad config; backend can degrade gracefully.
      reconnectStrategy: (retries) => {
        if (retries >= 10) return new Error('redis reconnect limit reached');
        return Math.min(retries * 200, 3000);
      },
    },
  });

  client.on('error', (err) => {
    console.warn('[redis] error:', err?.message || err);
  });

  client.on('connect', () => {
    console.log('[redis] connected');
  });

  client.on('reconnecting', () => {
    console.log('[redis] reconnecting...');
  });

  client.on('end', () => {
    console.warn('[redis] connection closed');
  });

  return client;
}

async function ensureRedisConnected() {
  const c = getRedisClient();
  if (!c) return null;
  if (c.isReady) return c;

  if (!connectPromise) {
    connectPromise = c.connect().catch((err) => {
      connectPromise = null;
      console.warn('[redis] connect failed:', err?.message || err);
      return null;
    });
  }

  return connectPromise;
}

module.exports = {
  getRedisClient,
  ensureRedisConnected,
};