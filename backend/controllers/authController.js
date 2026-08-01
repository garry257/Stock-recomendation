const User = require('../models/User');

const register = async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = new User({ username, password });
        await user.save();
        res.json({ success: true, message: "Registered successfully" });
    } catch (err) {
        if (err.code === 11000) {
            res.status(400).json({ success: false, message: "Username already exists" });
        } else {
            console.error("Registration error:", err);
            res.status(500).json({ success: false, message: "Database error. Check your MongoDB connection." });
        }
    }
};

const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username, password });
        if (user) {
            res.json({ success: true, userId: user._id, username: user.username });
        } else {
            res.json({ success: false, message: "Invalid credentials" });
        }
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ success: false, message: "Database error. Check your MongoDB connection." });
    }
};

module.exports = {
    register,
    login
};
