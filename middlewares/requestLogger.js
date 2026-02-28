const morgan = require('morgan');
const logger = require('../utils/logger');

const env = process.env.NODE_ENV || 'development';

const morganStream = {
    write: (message) => logger.http(message.trim())
};

const morganMiddleware = morgan(
    env === 'production' ? 'combined' : 'dev',
    {
        skip: () => env === 'test',
        stream: morganStream
    }
);

module.exports = morganMiddleware;
