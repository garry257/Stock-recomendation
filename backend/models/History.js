const mongoose = require('mongoose');

const HistorySchema = new mongoose.Schema({
    ticker: String,
    name: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("History", HistorySchema);
