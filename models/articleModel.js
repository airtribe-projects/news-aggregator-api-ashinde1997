const userArticleStore = new Map();
const articleRegistry = new Map();
let articleIdCounter = 1;


function getUserStore(userId) {
    if (!userArticleStore.has(userId)) {
        userArticleStore.set(userId, { read: new Map(), favorites: new Map() });
    }
    return userArticleStore.get(userId);
}


function registerArticle(article) {
    for (const [id, existing] of articleRegistry.entries()) {
        if (existing.url === article.url) return { ...article, id };
    }

    const id = articleIdCounter++;
    const registered = { ...article, id };
    articleRegistry.set(id, registered);
    return registered;
}

function findArticleById(id) {
    return articleRegistry.get(Number(id));
}


function markAsRead(userId, article) {
    getUserStore(userId).read.set(article.url, article);
}

function getReadArticles(userId) {
    return [...getUserStore(userId).read.values()];
}


function markAsFavorite(userId, article) {
    getUserStore(userId).favorites.set(article.url, article);
}

function getFavoriteArticles(userId) {
    return [...getUserStore(userId).favorites.values()];
}


module.exports = {
    registerArticle,
    findArticleById,
    markAsRead,
    getReadArticles,
    markAsFavorite,
    getFavoriteArticles
};
