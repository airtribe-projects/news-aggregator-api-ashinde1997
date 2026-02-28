const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'verysecretkey';


// POST /users/signup
exports.signup = async (req, res, next) => {
    try {
        const { name, email, password, preferences } = req.body;
        logger.debug('signup attempt', { email });

        const existing = User.findByEmail(email);
        if (existing) {
            logger.warn('signup failed — email already exists', { email });
            return next(new AppError('A user with that email already exists', 400));
        }

        const hashed = await bcrypt.hash(password, 10);
        const user = User.create({
            name,
            email,
            password: hashed,
            preferences: Array.isArray(preferences) ? preferences : []
        });

        logger.info('user registered', { userId: user.id, email: user.email });
        return res.status(200).json({
            message: 'User registered successfully',
            user: { id: user.id, name: user.name, email: user.email }
        });

    } catch (err) {
        logger.error('signup error', { err: err.message });
        next(err);
    }
};


// POST /users/login
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        logger.debug('login attempt', { email });

        const user = User.findByEmail(email);
        if (!user) {
            logger.warn('login failed — user not found', { email });
            return next(new AppError('Invalid credentials', 401));
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            logger.warn('login failed — wrong password', { email });
            return next(new AppError('Invalid credentials', 401));
        }

        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        logger.info('user logged in', { userId: user.id, email: user.email });
        return res.status(200).json({ token });

    } catch (err) {
        logger.error('login error', { err: err.message });
        next(err);
    }
};


// GET /users/preferences
exports.getPreferences = (req, res, next) => {
    logger.debug('get preferences', { userId: req.user.id });

    const user = User.findById(req.user.id);
    if (!user) return next(new AppError('User not found', 404));

    return res.status(200).json({ preferences: user.preferences });
};


// PUT /users/preferences
exports.updatePreferences = (req, res, next) => {
    const { preferences } = req.body;
    logger.debug('update preferences', { userId: req.user.id, preferences });

    const updated = User.updatePreferences(req.user.id, preferences);
    if (!updated) return next(new AppError('User not found', 404));

    logger.info('preferences updated', { userId: req.user.id, preferences: updated.preferences });
    return res.status(200).json({ preferences: updated.preferences });
};
