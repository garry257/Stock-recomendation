const History = require('../models/History');

const getHistory = async (req, res) => {
    try {
        const userId = req.query.userId;
        let query = {};
        if (userId && userId !== "null") {
            query = { userId };
        } else {
            query = { userId: { $exists: false } };
        }
        const history = await History.find(query).sort({ timestamp: -1 }).limit(10);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: "Database error: " + err.message });
    }
};

const clearAllHistory = async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId || userId === "null") return res.status(401).json({ error: "Unauthorized" });
        await History.deleteMany({ userId });
        res.json({ success: true, message: "History cleared" });
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
};

const deleteHistoryItem = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.query.userId;
        await History.findOneAndDelete({ _id: id, userId });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
};

module.exports = {
    getHistory,
    clearAllHistory,
    deleteHistoryItem
};
