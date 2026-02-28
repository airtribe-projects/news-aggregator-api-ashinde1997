const DEFAULT_TTL_MS      = Number(process.env.CACHE_TTL_MS)             || 10 * 60 * 1000;
const SEARCH_TTL_MS       = Number(process.env.CACHE_SEARCH_TTL_MS)      ||  5 * 60 * 1000;
const REFRESH_INTERVAL_MS = Number(process.env.CACHE_REFRESH_INTERVAL_MS) || 15 * 60 * 1000;

const logger = require('../utils/logger');

const store = new Map();

function buildKey(preferences) {
    if (!preferences || preferences.length === 0) return '__top_headlines__';
    return [...preferences].sort().join('|').toLowerCase();
}

function get(preferences) {
    const key   = buildKey(preferences);
    const entry = store.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.cachedAt;
    if (age > entry.ttl) {
        store.delete(key);
        logger.debug(`[Cache] MISS (stale) key="${key}" age=${Math.round(age / 1000)}s`);
        return null;
    }

    logger.debug(`[Cache] HIT  key="${key}" age=${Math.round(age / 1000)}s`);
    return entry.articles;
}

function set(preferences, articles, ttl = DEFAULT_TTL_MS) {
    const key = buildKey(preferences);
    store.set(key, { articles, cachedAt: Date.now(), ttl });
    logger.debug(`[Cache] SET  key="${key}" articles=${articles.length} ttl=${ttl / 1000}s`);
}

function invalidate(preferences) {
    const key = buildKey(preferences);
    store.delete(key);
    logger.debug(`[Cache] DEL  key="${key}"`);
}

function flush() {
    store.clear();
}

function stats() {
    const entries = [];
    for (const [key, entry] of store.entries()) {
        entries.push({
            key,
            articles:   entry.articles.length,
            ageSeconds: Math.round((Date.now() - entry.cachedAt) / 1000),
            ttlSeconds: Math.round(entry.ttl / 1000)
        });
    }
    return entries;
}

let refreshTimer = null;

function startPeriodicRefresh(fetchFn, intervalMs = REFRESH_INTERVAL_MS) {
    if (refreshTimer) return;

    logger.info(`[Cache] Periodic refresh started — interval=${intervalMs / 1000}s`);

    refreshTimer = setInterval(async () => {
        const keys = [...store.keys()];
        if (keys.length === 0) return;

        logger.info(`[Cache] Periodic refresh — refreshing ${keys.length} key(s)`);

        for (const key of keys) {
            try {
                const preferences = key === '__top_headlines__' ? [] : key.split('|');
                const articles = await fetchFn(preferences);
                set(preferences, articles);
            } catch (err) {
                logger.error(`[Cache] Periodic refresh failed for key="${key}"`, { err: err.message });
            }
        }
    }, intervalMs);

    if (refreshTimer.unref) refreshTimer.unref();
}

function stopPeriodicRefresh() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
        logger.info('[Cache] Periodic refresh stopped');
    }
}

module.exports = { get, set, invalidate, flush, stats, buildKey, SEARCH_TTL_MS, startPeriodicRefresh, stopPeriodicRefresh };
