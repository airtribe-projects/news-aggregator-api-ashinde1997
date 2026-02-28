let users = [];
let idCounter = 1;


exports.findByEmail = (email) => users.find(u => u.email === email.toLowerCase());

exports.findById = (id) => users.find(u => u.id === id);

exports.create = ({ name, email, password, preferences }) => {
    const user = {
        id: idCounter++,
        name,
        email: email.toLowerCase(),
        password,
        preferences: Array.isArray(preferences) ? preferences : []
    };
    users.push(user);
    return user;
};

exports.updatePreferences = (id, preferences) => {
    const user = users.find(u => u.id === id);
    if (!user) return null;
    user.preferences = preferences;
    return user;
};

module.exports = exports;
