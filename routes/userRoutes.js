const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middlewares/auth');
const { validateSignup, validateLogin, validatePreferences, requireJson } = require('../middlewares/validate');

router.post('/signup',     requireJson, validateSignup,      userController.signup);
router.post('/login',      requireJson, validateLogin,       userController.login);
router.get('/preferences', auth,                             userController.getPreferences);
router.put('/preferences', auth, requireJson, validatePreferences, userController.updatePreferences);

module.exports = router;
