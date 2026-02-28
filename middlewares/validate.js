const { AppError } = require('./errorHandler');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const trim = (value) => (typeof value === 'string' ? value.trim() : value);

exports.requireJson = (req, res, next) => {
    if (!req.is('application/json')) {
        return next(new AppError('Content-Type must be application/json', 415));
    }
    next();
};


function assertBody(req, errors) {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        errors.push('request body must be a JSON object');
        return false;
    }
    return true;
}

exports.validateSignup = (req, res, next) => {
    const errors = [];
    if (!assertBody(req, errors)) return next(new AppError(errors[0], 400));

    const name = trim(req.body.name);
    const email = trim(req.body.email);
    const password = req.body.password;
    const prefs = req.body.preferences;

    if (!name || typeof name !== 'string') {
        errors.push('name is required and must be a string');
    } else if (name.length < 2 || name.length > 50) {
        errors.push('name must be between 2 and 50 characters');
    }

    if (!email || typeof email !== 'string') {
        errors.push('email is required and must be a string');
    } else if (!EMAIL_REGEX.test(email)) {
        errors.push('email must be a valid email address');
    }

    if (password === undefined || password === null) {
        errors.push('password is required');
    } else if (typeof password !== 'string') {
        errors.push('password must be a string');
    } else {
        if (password.length < 6) errors.push('password must be at least 6 characters long');
        if (password.length > 72) errors.push('password must be no more than 72 characters long');
        if (!/[a-zA-Z]/.test(password)) errors.push('password must contain at least one letter');
        if (!/[0-9]/.test(password)) errors.push('password must contain at least one number');
    }

    if (prefs !== undefined) {
        if (!Array.isArray(prefs)) {
            errors.push('preferences must be an array');
        } else if (prefs.length > 20) {
            errors.push('preferences can contain at most 20 items');
        } else {
            prefs.forEach((p, i) => {
                if (typeof p !== 'string' || p.trim() === '') {
                    errors.push(`preferences[${i}] must be a non-empty string`);
                } else if (p.trim().length > 50) {
                    errors.push(`preferences[${i}] must be no more than 50 characters`);
                }
            });
        }
    }

    if (errors.length > 0) {
        return next(new AppError('Validation failed', 400, errors));
    }

    req.body = {
        name,
        email,
        password,
        ...(prefs !== undefined && { preferences: prefs.map(p => p.trim().toLowerCase()) })
    };

    next();
};


exports.validateLogin = (req, res, next) => {
    const errors = [];
    if (!assertBody(req, errors)) return next(new AppError(errors[0], 400));

    const email = trim(req.body.email);
    const password = req.body.password;

    if (!email || typeof email !== 'string') {
        errors.push('email is required and must be a string');
    } else if (!EMAIL_REGEX.test(email)) {
        errors.push('email must be a valid email address');
    }

    if (password === undefined || password === null) {
        errors.push('password is required');
    } else if (typeof password !== 'string') {
        errors.push('password must be a string');
    } else if (password.length === 0) {
        errors.push('password must not be empty');
    }

    if (errors.length > 0) {
        return next(new AppError('Validation failed', 400, errors));
    }

    req.body = { email, password };
    next();
};


exports.validatePreferences = (req, res, next) => {
    const errors = [];
    if (!assertBody(req, errors)) return next(new AppError(errors[0], 400));

    const prefs = req.body.preferences;

    if (prefs === undefined || prefs === null) {
        errors.push('preferences is required');
    } else if (!Array.isArray(prefs)) {
        errors.push('preferences must be an array');
    } else if (prefs.length === 0) {
        errors.push('preferences must contain at least one item');
    } else if (prefs.length > 20) {
        errors.push('preferences can contain at most 20 items');
    } else {
        prefs.forEach((p, i) => {
            if (typeof p !== 'string' || p.trim() === '') {
                errors.push(`preferences[${i}] must be a non-empty string`);
            } else if (p.trim().length > 50) {
                errors.push(`preferences[${i}] must be no more than 50 characters`);
            }
        });
    }

    if (errors.length > 0) {
        return next(new AppError('Validation failed', 400, errors));
    }

    const cleaned = [...new Set(prefs.map(p => p.trim().toLowerCase()))];
    req.body = { preferences: cleaned };
    next();
};
