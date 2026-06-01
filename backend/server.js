
// Imports and setup
const express = require('express');
const cors = require('cors');
const path = require('path');
const dns = require('dns');

// Removed custom DNS setting as it can interfere with cloud providers like Render

require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// DATABASE CONNECTION
const mongoose = require('mongoose');

console.log(process.env.MONGO_URL);
mongoose.connect(process.env.MONGO_URL, {
    serverSelectionTimeoutMS: 5000 // Timeout after 5s
})
.then(() => {
    console.log("MongoDB Connected");
})
.catch((err) => {
    console.error("MongoDB Connection Error:", err.message);
});

// Disable buffering so that if DB is disconnected, requests fail immediately instead of hanging
mongoose.set('bufferCommands', false);

// Schemas
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true }
});
const User = mongoose.model("User", UserSchema);

const HistorySchema = new mongoose.Schema({
    ticker: String,
    name: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now }
});
const History = mongoose.model("History", HistorySchema);

// Auth Routes
app.post("/api/register", async (req, res) => {
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
});

app.post("/api/login", async (req, res) => {
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
});



// Universal stock scraper (Fundamentals)
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
};

function extractTicker(url) {
    if (!url) return null;
    const parts = url.split('/').filter(Boolean);
    if (parts.length >= 2) {
        if (parts[1] === 'id') return parts[2];
        return parts[1];
    }
    return null;
}

async function getStockData(ticker) {
    try {
        const searchUrl = `https://www.screener.in/api/company/search/?q=${ticker}`;
        const searchRes = await fetch(searchUrl, { headers });
        const searchData = await searchRes.json();
        if (!searchData || searchData.length === 0) return null; // fallback to Yahoo
        const company = searchData[0];
        const companyUrl = `https://www.screener.in${company.url}`;
        const pageRes = await fetch(companyUrl, { headers });
        const html = await pageRes.text();
        const extractValue = (labels) => {
            if (!Array.isArray(labels)) labels = [labels];
            for (let label of labels) {
                const regex = new RegExp(label + '[^]*?class="number">([^<]+)', 'i');
                const match = html.match(regex);
                if (match) {
                    let val = match[1].trim().replace(/,/g, '');
                    if (label.toLowerCase().includes("growth") && parseFloat(val) > 500) continue;
                    return val;
                }
            }
            return "N/A";
        };
        const price = extractValue("Current Price");
        const marketCap = extractValue("Market Cap");
        const divYield = extractValue("Dividend Yield");
        const bookValue = extractValue("Book Value");
        const faceValue = extractValue("Face Value");
        const pe = extractValue(["Stock P/E", "P/E Ratio"]);
        const roe = extractValue(["ROE", "Return on equity"]);
        const debtEquity = extractValue(["Debt to equity", "Debt / Equity"]);
        const salesGrowth = extractValue(["Sales growth", "Sales growth 3Years", "Sales growth 5Years"]);
        const profitGrowth = extractValue(["Profit growth", "Profit growth 3Years", "Profit growth 5Years"]);
        const scoreVal = (val, h, m) => {
            const n = parseFloat(val);
            if (isNaN(n)) return 10;
            return n >= h ? 20 : (n >= m ? 10 : 0);
        };
        const peVal = parseFloat(pe);
        const deVal = parseFloat(debtEquity);
        const factors = {
            revenueGrowth: { value: salesGrowth !== "N/A" ? salesGrowth : "N/A", score: scoreVal(salesGrowth, 15, 5) },
            profitGrowth: { value: profitGrowth !== "N/A" ? profitGrowth : "N/A", score: scoreVal(profitGrowth, 15, 5) },
            debtEquity: { value: debtEquity, score: isNaN(deVal) ? 10 : (deVal < 0.5 ? 20 : (deVal <= 1.5 ? 10 : 0)) },
            peRatio: { value: pe, score: isNaN(peVal) ? 10 : (peVal < 15 ? 20 : (peVal <= 30 ? 10 : 0)) },
            roe: { value: roe !== "N/A" ? roe : "N/A", score: scoreVal(roe, 15, 10) }
        };
        const companyStats = {
            marketCap: marketCap !== "N/A" ? marketCap : "N/A",
            divYield: divYield !== "N/A" ? divYield : "N/A",
            bookValue: bookValue !== "N/A" ? bookValue : "N/A",
            faceValue: faceValue !== "N/A" ? faceValue : "N/A"
        };
        const totalScore = Object.values(factors).reduce((acc, f) => acc + f.score, 0);
        const resolvedTicker = extractTicker(company.url) || ticker.toUpperCase();
        return {
            ticker: resolvedTicker,
            name: company.name,
            sector: "Indian Market",
            price: price !== "N/A" ? price : "0.00",
            factors,
            companyStats,
            totalScore
        };
    } catch (error) {
        console.error("Error in getStockData:", error.message);
        return null;
    }
}

// Technical indicators helpers
const { RSI, MACD, ATR } = require('technicalindicators');

function getIntervalAndRange(timeframe) {
    switch (timeframe) {
        case '5m': return { interval: '5m', range: '5d' };
        case '15m': return { interval: '15m', range: '5d' };
        case '30m': return { interval: '30m', range: '1mo' };
        case '1h': return { interval: '60m', range: '1mo' };
        case '4h': return { interval: '60m', range: '1mo' }; // using 60m for 4h as it's the closest intraday
        case '1d': default: return { interval: '1d', range: '3mo' };
    }
}

function calculateTechnicals(result) {
    const timestamps = result.timestamp;
    const closes = result.indicators.quote[0].close;
    const highs = result.indicators.quote[0].high;
    const lows = result.indicators.quote[0].low;
    const opens = result.indicators.quote[0].open;
    let validData = [];
    for (let i = 0; i < closes.length; i++) {
        if (closes[i] != null && highs[i] != null && lows[i] != null && opens[i] != null) {
            validData.push({ time: timestamps[i], open: opens[i], high: highs[i], low: lows[i], close: closes[i] });
        }
    }
    if (validData.length < 30) throw new Error("Not enough data for indicators");
    const closeValues = validData.map(d => d.close);
    const highValues = validData.map(d => d.high);
    const lowValues = validData.map(d => d.low);
    const rsiResult = RSI.calculate({ values: closeValues, period: 14 });
    const macdResult = MACD.calculate({ values: closeValues, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
    const atrResult = ATR.calculate({ high: highValues, low: lowValues, close: closeValues, period: 14 });
    if (!rsiResult.length || !macdResult.length) throw new Error("Failed to calculate RSI or MACD");
    const currentRSI = rsiResult[rsiResult.length - 1];
    const currentMACD = macdResult[macdResult.length - 1];
    const currentATR = atrResult && atrResult.length ? atrResult[atrResult.length - 1] : 0;
    const currentPrice = closeValues[closeValues.length - 1];
    let signal = "HOLD";
    let explanation = "Market is neutral. Waiting for a clear trend.";
    if (currentRSI < 45 && currentMACD && currentMACD.MACD > currentMACD.signal) {
        signal = "BUY";
        explanation = "RSI is recovering and MACD shows a bullish crossover. Good entry point.";
    } else if (currentRSI > 60 && currentMACD && currentMACD.MACD < currentMACD.signal) {
        signal = "SELL";
        explanation = "RSI is overbought and MACD shows a bearish crossover. Consider taking profits.";
    }
    let entry = 0, target = 0, stopLoss = 0;
    if (signal === "BUY" || signal === "HOLD") {
        // If HOLD, provide a hypothetical BUY setup so the UI panel always shows
        entry = currentPrice;
        stopLoss = entry - (currentATR * 1.5);
        target = entry + (currentATR * 3);
    } else if (signal === "SELL") {
        entry = currentPrice;
        stopLoss = entry + (currentATR * 1.5);
        target = entry - (currentATR * 3);
    }
    // Prepare series for chart
    const rsiData = [];
    const rsiOffset = validData.length - rsiResult.length;
    for (let i = 0; i < rsiResult.length; i++) {
        rsiData.push({ time: validData[i + rsiOffset].time, value: rsiResult[i] });
    }
    const macdData = [];
    const macdOffset = validData.length - macdResult.length;
    for (let i = 0; i < macdResult.length; i++) {
        if (macdResult[i].MACD !== undefined) {
            macdData.push({ time: validData[i + macdOffset].time, macd: macdResult[i].MACD, signalLine: macdResult[i].signal, hist: macdResult[i].histogram });
        }
    }
    const tradeSetupObj = (signal === "BUY" || signal === "SELL")
        ? { entry: entry.toFixed(2), target: target.toFixed(2), stopLoss: stopLoss.toFixed(2) }
        : null;

    return {
        rsi: currentRSI.toFixed(2),
        macdLine: currentMACD.MACD.toFixed(2),
        macdSignal: currentMACD.signal.toFixed(2),
        macdHist: currentMACD.histogram.toFixed(2),
        signal,
        explanation,
        tradeSetup: tradeSetupObj,
        chartData: { candles: validData, rsi: rsiData, macd: macdData }
    };
}



// Yahoo Finance daily/intraday getIndicators
async function getIndicators(ticker, isIndian, timeframe = '1d') {
    try {
        let symbol = ticker.toUpperCase();
        if (isIndian && !symbol.includes('.')) {
            symbol += '.NS';
        }
        const { interval, range } = getIntervalAndRange(timeframe);
        // Yahoo Finance fetch
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (res.ok) {
            const data = await res.json();
            if (data.chart && data.chart.result && data.chart.result[0]) {
                return calculateTechnicals(data.chart.result[0]);
            }
        }
        // Fallback for Indian BSE
        if (isIndian && symbol.endsWith('.NS')) {
            const bseSymbol = symbol.replace('.NS', '.BO');
            const bseUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${bseSymbol}?interval=${interval}&range=${range}`;
            const bseRes = await fetch(bseUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (bseRes.ok) {
                const bseData = await bseRes.json();
                if (bseData.chart && bseData.chart.result && bseData.chart.result[0]) {
                    return calculateTechnicals(bseData.chart.result[0]);
                }
            }
        }
        throw new Error("No chart data from Yahoo Finance");
    } catch (err) {
        console.error(`Indicator Error for ${ticker}:`, err.message);
        return null;
    }
}

// US/Global fallback via Yahoo Finance daily/intraday
async function getUSStockDataAndTechnicals(ticker, timeframe = '1d') {
    const symbol = ticker.toUpperCase();
    let chartResult = null;
    const { interval, range } = getIntervalAndRange(timeframe);
    // Try without suffix
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (res.ok) {
            const data = await res.json();
            if (data.chart && data.chart.result && data.chart.result[0]) {
                chartResult = data.chart.result[0];
            }
        }
    } catch (err) {
        console.error(`US Stock chart fetch failed for ${symbol}:`, err.message);
    }
    // If that fails, try with .NS suffix
    if (!chartResult) {
        try {
            const url = `https://query1.finance.com/v8/finance/chart/${symbol}.NS?interval=${interval}&range=${range}`;
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (res.ok) {
                const data = await res.json();
                if (data.chart && data.chart.result && data.chart.result[0]) {
                    chartResult = data.chart.result[0];
                }
            }
        } catch (err) {
            console.error(`US Stock NS chart fetch failed for ${symbol}:`, err.message);
        }
    }
    // If both failed, try with .BO suffix
    if (!chartResult) {
        try {
            const url = `https://query1.finance.com/v8/finance/chart/${symbol}.BO?interval=${interval}&range=${range}`;
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (res.ok) {
                const data = await res.json();
                if (data.chart && data.chart.result && data.chart.result[0]) {
                    chartResult = data.chart.result[0];
                }
            }
        } catch (err) {
            console.error(`US Stock BO chart fetch failed for ${symbol}:`, err.message);
        }
    }
    if (!chartResult) {
        throw new Error(`Stock "${ticker}" not found on Screener or Yahoo Finance.`);
    }
    const meta = chartResult.meta;
    const name = meta.longName || meta.shortName || symbol;
    const price = meta.regularMarketPrice ? meta.regularMarketPrice.toString() : "0.00";
    const currency = meta.currency || "USD";
    let indicators = null;
    try {
        indicators = calculateTechnicals(chartResult);
    } catch (err) {
        console.error(`Technicals calculation failed for ${symbol}:`, err.message);
    }
    const data = {
        ticker: symbol,
        name,
        sector: currency === "INR" ? "Indian Market" : `Global Market (${currency})`,
        price,
        factors: { revenueGrowth: { value: "N/A", score: 0 }, profitGrowth: { value: "N/A", score: 0 }, debtEquity: { value: "N/A", score: 0 }, peRatio: { value: "N/A", score: 0 }, roe: { value: "N/A", score: 0 } },
        companyStats: { marketCap: "N/A", divYield: "N/A", bookValue: "N/A", faceValue: "N/A", sipSuitability: "N/A", sipExplanation: "Fundamental metrics are currently only supported for Indian companies." },
        totalScore: 0,
        ratingExplanation: currency === "INR" ? "Real-time indicators processed successfully." : "US / Global stock indicators processed successfully. Fundamentals are not available."
    };
    if (indicators) {
        data.indicators = indicators;
        data.rating = indicators.signal;
        data.ratingExplanation = indicators.explanation;
        if (indicators.tradeSetup) data.tradeSetup = indicators.tradeSetup;
    } else {
        data.rating = "UNKNOWN";
        data.ratingExplanation = "Could not fetch technical indicators.";
    }
    return data;
}

// ROUTES
app.get('/api/stock/:ticker', async (req, res) => {
    try {
        const ticker = req.params.ticker.toUpperCase();
        const userId = req.query.userId;
        const timeframe = req.query.timeframe || '1d';
        console.log(`\n🔍 Searching: ${ticker} (TF: ${timeframe}, User: ${userId || "Guest"})`);
        let data = null;
        // Try fundamentals first via Screener
        try {
            data = await getStockData(ticker);
        } catch (err) {
            console.log(`Screener error for ${ticker}, will try Yahoo Finance fallback.`);
        }
        if (data) {
            const indicators = await getIndicators(data.ticker, true, timeframe);
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
            data = await getUSStockDataAndTechnicals(ticker, timeframe);
        }
        if (userId && userId !== "null") {
            await History.create({ ticker: data.ticker || ticker, name: data.name, userId });
        }
        res.json(data);
    } catch (error) {
        console.error(`❌ Error fetching ${req.params.ticker}:`, error.message);
        res.status(404).json({ error: error.message });
    }
});

// History endpoints (unchanged)
app.get('/api/history', async (req, res) => {
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
});

app.delete('/api/history/all', async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId || userId === "null") return res.status(401).json({ error: "Unauthorized" });
        await History.deleteMany({ userId });
        res.json({ success: true, message: "History cleared" });
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

app.delete('/api/history/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.query.userId;
        await History.findOneAndDelete({ _id: id, userId });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

// Start server
const PORT = parseInt(process.env.PORT, 10) || 5005;

function startServer(port) {
    const server = app.listen(port, () => {
        console.log(`🚀 Universal Stock Server running at http://localhost:${port}`);
        console.log(`📊 Works for both Indian (ZOMATO, RELIANCE) and US stocks!`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            const nextPort = port + 1;
            console.warn(`⚠ Port ${port} is already in use. Trying port ${nextPort}...`);
            startServer(nextPort);
        } else {
            console.error('Server failed to start:', err);
            process.exit(1);
        }
    });
}

startServer(PORT);