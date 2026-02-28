class AppError extends Error {
    constructor(message, statusCode = 500, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}

function errorResponse(res, statusCode, message, details = null) {
    const body = {
        status: statusCode,
        error: message,
        timestamp: new Date().toISOString()
    };

    if (details) body.details = details;

    return res.status(statusCode).json(body);
}

const notFound = (req, res, next) => {
    const logger = require('../utils/logger');
    logger.debug('404 — route not found', { method: req.method, url: req.originalUrl });
    next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};


const globalErrorHandler = (err, req, res, next) => {
    const logger = require('../utils/logger');

    if (err.type === 'entity.parse.failed') {
        logger.warn('invalid JSON body', { path: req.originalUrl });
        return errorResponse(res, 400, 'Invalid JSON in request body');
    }

    if (err.name === 'JsonWebTokenError') {
        logger.debug('JWT error', { err: err.message });
        return errorResponse(res, 401, 'Invalid token');
    }

    if (err.name === 'TokenExpiredError') {
        logger.debug('JWT expired');
        return errorResponse(res, 401, 'Token has expired');
    }

    if (err.isOperational) {
        logger.warn('operational error', { message: err.message, status: err.statusCode, path: req.originalUrl });
        return errorResponse(res, err.statusCode, err.message, err.details || null);
    }

    logger.error('unhandled error', { err: err.message, stack: err.stack, path: req.originalUrl });
    return errorResponse(res, 500, 'Something went wrong. Please try again later.');
};

module.exports = { AppError, errorResponse, notFound, globalErrorHandler };
