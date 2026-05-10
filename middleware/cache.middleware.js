const DEFAULT_TTL_MS = 10000;
const DEFAULT_MAX_ITEMS = 500;

function cacheResponse(options = {}) {
  const ttlMs = Number(options.ttlMs || DEFAULT_TTL_MS);
  const maxItems = Number(options.maxItems || DEFAULT_MAX_ITEMS);
  const store = new Map();

  return (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    const userKey = req.user ? `${req.user.role}:${req.user.userId}` : 'anon';
    const cacheKey = `${req.originalUrl}|${userKey}`;
    const now = Date.now();
    const cached = store.get(cacheKey);

    if (cached && cached.expiresAt > now) {
      res.set('X-Cache', 'HIT');
      return res.status(cached.status).json(cached.body);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        store.set(cacheKey, {
          expiresAt: now + ttlMs,
          status: res.statusCode,
          body,
        });
        if (store.size > maxItems) {
          const firstKey = store.keys().next().value;
          if (firstKey) {
            store.delete(firstKey);
          }
        }
      }
      res.set('X-Cache', 'MISS');
      return originalJson(body);
    };

    return next();
  };
}

module.exports = { cacheResponse };
