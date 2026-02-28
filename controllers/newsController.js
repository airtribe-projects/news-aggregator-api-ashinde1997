const { fetchNewsByPreferences, searchNews } = require('../services/newsService');
const { AppError } = require('../middlewares/errorHandler');
const cache = require('../services/cacheService');
const ArticleModel = require('../models/articleModel');
const logger = require('../utils/logger');


function guardApiKey(next) {
    if (!process.env.NEWS_API_KEY || process.env.NEWS_API_KEY === 'your_newsapi_key_here') {
        next(new AppError('News API key is not configured. Set NEWS_API_KEY in .env', 503));
        return false;
    }
    return true;
}

function shapeAndRegister(article) {
    const shaped = {
        title: article.title ?? null,
        description: article.description ?? null,
        url: article.url ?? null,
        source: article.source?.name ?? null,
        publishedAt: article.publishedAt ?? null,
        urlToImage: article.urlToImage ?? null
    };
    return ArticleModel.registerArticle(shaped);
}

function mapFetchError(err, next) {
    if (err.response) {
        const status = err.response.status;
        const message = err.response.data?.message || err.message;

        if (status === 401) return next(new AppError(`News API auth failed: ${message}`, 503));
        if (status === 429) return next(new AppError('News API rate limit exceeded.', 503));
        return next(new AppError(`News API error (${status}): ${message}`, 503));
    }

    if (err.code === 'ECONNABORTED') return next(new AppError('News API request timed out.', 503));
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
        return next(new AppError('Unable to reach the News API.', 503));
    }

    next(err);
}

function resolveArticleId(raw, next) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1) {
        next(new AppError('Article id must be a positive integer', 400));
        return null;
    }
    return id;
}


// GET /news
exports.getNews = async (req, res, next) => {
    const apiKeyMissing = !process.env.NEWS_API_KEY ||
        process.env.NEWS_API_KEY === 'your_newsapi_key_here';

    if (apiKeyMissing) {
        logger.warn('getNews called but NEWS_API_KEY is not set — returning empty feed');
        return res.status(200).json({
            news: [],
            message: 'NEWS_API_KEY is not configured — set it in .env to receive real articles.'
        });
    }

    const preferences = req.user?.preferences || [];
    logger.debug('fetching news', { userId: req.user.id, preferences });

    try {
        const articles = await fetchNewsByPreferences(preferences);
        const news = articles.map(shapeAndRegister);

        logger.info('news fetched', { userId: req.user.id, count: news.length, preferences });
        return res.status(200).json({ count: news.length, news });
    } catch (err) {
        logger.error('getNews fetch error', { err: err.message, code: err.code });
        mapFetchError(err, next);
    }
};


// GET /news/search/:keyword
exports.searchNews = async (req, res, next) => {
    if (!guardApiKey(next)) return;

    const keyword = req.params.keyword?.trim();

    if (!keyword) return next(new AppError('keyword is required', 400));
    if (keyword.length > 100) return next(new AppError('keyword must be 100 characters or fewer', 400));

    logger.debug('search news', { userId: req.user.id, keyword });

    try {
        const articles = await searchNews(keyword);
        const news = articles.map(shapeAndRegister);

        logger.info('search completed', { userId: req.user.id, keyword, count: news.length });
        return res.status(200).json({ keyword, count: news.length, news });
    } catch (err) {
        logger.error('searchNews error', { keyword, err: err.message });
        mapFetchError(err, next);
    }
};


// POST /news/:id/read
exports.markAsRead = (req, res, next) => {
    const id = resolveArticleId(req.params.id, next);
    if (id === null) return;

    const article = ArticleModel.findArticleById(id);
    if (!article) {
        return next(new AppError(`Article ${id} not found. Fetch /news first to populate the registry.`, 404));
    }

    const alreadyRead = ArticleModel.getReadArticles(req.user.id).some(a => a.id === id);
    ArticleModel.markAsRead(req.user.id, article);

    logger.info('article marked as read', { userId: req.user.id, articleId: id, alreadyRead });
    return res.status(200).json({
        message: alreadyRead ? 'Article was already marked as read' : 'Article marked as read',
        article
    });
};


// POST /news/:id/favorite
exports.markAsFavorite = (req, res, next) => {
    const id = resolveArticleId(req.params.id, next);
    if (id === null) return;

    const article = ArticleModel.findArticleById(id);
    if (!article) {
        return next(new AppError(`Article ${id} not found. Fetch /news first to populate the registry.`, 404));
    }

    const alreadyFav = ArticleModel.getFavoriteArticles(req.user.id).some(a => a.id === id);
    ArticleModel.markAsFavorite(req.user.id, article);

    logger.info('article marked as favorite', { userId: req.user.id, articleId: id, alreadyFav });
    return res.status(200).json({
        message: alreadyFav ? 'Article was already marked as favorite' : 'Article marked as favorite',
        article
    });
};


// GET /news/read
exports.getReadArticles = (req, res) => {
    const articles = ArticleModel.getReadArticles(req.user.id);
    logger.debug('get read articles', { userId: req.user.id, count: articles.length });
    return res.status(200).json({ count: articles.length, articles });
};


// GET /news/favorites
exports.getFavoriteArticles = (req, res) => {
    const articles = ArticleModel.getFavoriteArticles(req.user.id);
    logger.debug('get favorite articles', { userId: req.user.id, count: articles.length });
    return res.status(200).json({ count: articles.length, articles });
};


// GET /news/cache/stats
exports.getCacheStats = (req, res) => {
    logger.debug('cache stats requested', { userId: req.user.id });
    return res.status(200).json({ cache: cache.stats() });
};
