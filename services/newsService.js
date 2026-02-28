const axios = require('axios');
const { get: cacheGet, set: cacheSet, SEARCH_TTL_MS } = require('./cacheService');
const logger = require('../utils/logger');

const BASE_URL = process.env.NEWS_API_BASE_URL || 'https://newsapi.org/v2';
const API_KEY  = process.env.NEWS_API_KEY;


// Shared helper — fires a GET and returns articles array
async function axiosFetch(endpoint, params) {
    const response = await axios.get(`${BASE_URL}/${endpoint}`, {
        params: { ...params, apiKey: API_KEY },
        timeout: 5000
    });
    return response.data.articles || [];
}


async function fetchArticlesByTopic(topic) {
    return axiosFetch('everything', { q: topic, language: 'en', sortBy: 'publishedAt', pageSize: 5 });
}


async function fetchTopHeadlines() {
    return axiosFetch('top-headlines', { language: 'en', pageSize: 10 });
}


function deduplicateArticlesByUrl(arrays) {
    const seen = new Set();
    return arrays.flat().filter(article => {
        if (!article.url || seen.has(article.url)) return false;
        seen.add(article.url);
        return true;
    });
}


async function fetchNewsByPreferences(preferences) {
    const cached = cacheGet(preferences);
    if (cached) return cached;

    logger.debug('[NewsService] cache miss — fetching from API', { preferences });

    let articles;

    if (!preferences || preferences.length === 0) {
        articles = await fetchTopHeadlines();
    } else {
        const results = await Promise.allSettled(
            preferences.map(topic => fetchArticlesByTopic(topic))
        );

        articles = deduplicateArticlesByUrl(
            results.map((r, i) => {
                if (r.status === 'rejected') {
                    logger.error(`[NewsService] fetch failed for "${preferences[i]}"`, { err: r.reason?.message });
                    return [];
                }
                return r.value;
            })
        );
    }

    logger.debug('[NewsService] fetched articles', { count: articles.length, preferences });
    cacheSet(preferences, articles);
    return articles;
}


async function searchNews(keyword) {
    const cacheKey = [`__search__${keyword.toLowerCase()}`];

    const cached = cacheGet(cacheKey);
    if (cached) {
        logger.debug('[NewsService] search cache hit', { keyword });
        return cached;
    }

    logger.debug('[NewsService] search cache miss — fetching from API', { keyword });

    const articles = await axiosFetch('everything', { q: keyword, language: 'en', sortBy: 'relevancy', pageSize: 20 });
    cacheSet(cacheKey, articles, SEARCH_TTL_MS);
    return articles;
}


module.exports = { fetchNewsByPreferences, searchNews };
