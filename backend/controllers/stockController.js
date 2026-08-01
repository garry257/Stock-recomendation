const History = require('../models/History');
const stockService = require('../services/stockService');

const getStockInfo = async (req, res) => {
    try {
        const ticker = req.params.ticker.toUpperCase();
        const userId = req.query.userId;
        const timeframe = req.query.timeframe || '1d';
        console.log(`\n🔍 Searching: ${ticker} (TF: ${timeframe}, User: ${userId || "Guest"})`);
        
        let data = null;
        // Try fundamentals first via Screener
        try {
            data = await stockService.getStockData(ticker);
        } catch (err) {
            console.log(`Screener error for ${ticker}, will try Yahoo Finance fallback.`);
        }
        
        if (data) {
            const indicators = await stockService.getIndicators(data.ticker, true, timeframe);
            if (indicators) {
                data.indicators = indicators;
                data.rating = indicators.signal;
                data.ratingExplanation = indicators.explanation;
                if (indicators.tradeSetup) data.tradeSetup = indicators.tradeSetup;
            } else {
                data.rating = "UNKNOWN";
                data.ratingExplanation = "Could not fetch technical indicators.";
            }
        } else {
            console.log(`Fallback query on Yahoo Finance for ${ticker}`);
            data = await stockService.getUSStockDataAndTechnicals(ticker, timeframe);
        }
        
        if (userId && userId !== "null") {
            await History.create({ ticker: data.ticker || ticker, name: data.name, userId });
        }
        
        res.json(data);
    } catch (error) {
        console.error(`❌ Error fetching ${req.params.ticker}:`, error.message);
        res.status(404).json({ error: error.message });
    }
};

module.exports = {
    getStockInfo
};
