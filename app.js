require('dotenv').config();

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

const logger = require('./utils/logger');
const requestLogger = require('./middlewares/requestLogger');
const { notFound, globalErrorHandler } = require('./middlewares/errorHandler');
const { startPeriodicRefresh } = require('./services/cacheService');
const { fetchNewsByPreferences } = require('./services/newsService');

const userRoutes = require('./routes/userRoutes');
const newsRoutes = require('./routes/newsRoutes');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.use('/users', userRoutes);
app.use('/news', newsRoutes);

app.use(notFound);
app.use(globalErrorHandler);

app.listen(port, (err) => {
    if (err) {
        logger.error('Failed to start server', { err: err.message });
        return;
    }

    logger.info(`Server is listening on port ${port}`, { port, env: process.env.NODE_ENV || 'development' });

    if (process.env.NEWS_API_KEY && process.env.NEWS_API_KEY !== 'your_newsapi_key_here') {
        startPeriodicRefresh(fetchNewsByPreferences);
    } else {
        logger.warn('NEWS_API_KEY not set — periodic cache refresh disabled');
    }
});

module.exports = app;