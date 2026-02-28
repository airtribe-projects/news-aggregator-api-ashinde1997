const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'verysecretkey';

module.exports = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        logger.debug('auth failed — no Authorization header', { path: req.originalUrl });
        return res.status(401).json({ error: 'Authorization header missing' });
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        logger.debug('auth failed — malformed Authorization header', { path: req.originalUrl });
        return res.status(401).json({ error: 'Authorization header must be: Bearer <token>' });
    }

    const token = parts[1];

    try {
        const payload = jwt.verify(token, JWT_SECRET);

        const user = User.findById(payload.id);
        if (!user) {
            logger.warn('auth failed — token valid but user not found', { userId: payload.id });
            return res.status(401).json({ error: 'Token is valid but user no longer exists' });
        }

        req.user = { id: user.id, email: user.email, preferences: user.preferences };
        logger.debug('auth passed', { userId: user.id, path: req.originalUrl });
        next();

    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            logger.debug('auth failed — token expired', { path: req.originalUrl });
            return res.status(401).json({ error: 'Token has expired' });
        }

        logger.debug('auth failed — invalid token', { path: req.originalUrl, err: err.message });
        return res.status(401).json({ error: 'Invalid token' });
    }
};
