const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newsController');
const auth = require('../middlewares/auth');

router.get('/',                auth, newsController.getNews);
router.get('/read',            auth, newsController.getReadArticles);
router.get('/favorites',       auth, newsController.getFavoriteArticles);
router.get('/cache/stats',     auth, newsController.getCacheStats);
router.get('/search/:keyword', auth, newsController.searchNews);
router.post('/:id/read',       auth, newsController.markAsRead);
router.post('/:id/favorite',   auth, newsController.markAsFavorite);

module.exports = router;
