const { createLogger, format, transports } = require('winston');

const customLevels = {
    levels: { error: 0, warn: 1, info: 2, http: 3, debug: 4 }
};

const plainFmt = format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
        return `${timestamp} [${level.toUpperCase()}]: ${message}${metaStr}`;
    })
);

const env = process.env.NODE_ENV || 'development';
const logLevel = process.env.LOG_LEVEL ||
    (env === 'production' ? 'info' : env === 'test' ? 'warn' : 'debug');

const logger = createLogger({
    levels: customLevels.levels,
    level: logLevel,
    transports: [
        new transports.Console({
            format: plainFmt,
            silent: process.env.LOG_SILENT === 'true'
        })
    ],
    exitOnError: false
});

logger.debug(`Logger initialised — env=${env} level=${logLevel}`);

module.exports = logger;

