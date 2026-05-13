import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// DATABASE CONNECTION

const MONGO_URI = 'mongodb://127.0.0.1:27017/stockiq_mini';

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected!"))
    .catch(err => console.error("❌ MongoDB Error:", err.message));

// 1. Schemas
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

// 2. Auth Routes
app.post("/api/register", async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = new User({ username, password });
        await user.save();
        res.json({ success: true, message: "Registered successfully" });
    } catch (err) {
        res.status(400).json({ success: false, message: "Username already exists" });
    }
});

app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (user) {
        res.json({ success: true, userId: user._id, username: user.username });
    } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
    }
});


// UNIVERSAL STOCK SCRAPER (Works for any ticker)

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
};

async function getStockData(ticker) {
    try {
        // 1. Search for company on Screener.in (Best for Indian Stocks)
        const searchUrl = `https://www.screener.in/api/company/search/?q=${ticker}`;
        const searchRes = await fetch(searchUrl, { headers });
        const searchData = await searchRes.json();

        if (!searchData || searchData.length === 0) {
            throw new Error(`Stock "${ticker}" not found.`);
        }

        const company = searchData[0];
        const companyUrl = `https://www.screener.in${company.url}`;

        // 2. Fetch company page
        const pageRes = await fetch(companyUrl, { headers });
        const html = await pageRes.text();

        // 3. Extract data using Robust Search
        const extractValue = (labels) => {
            if (!Array.isArray(labels)) labels = [labels];
            for (let label of labels) {
                // Look for the label followed by a span with class "number"
                const regex = new RegExp(label + '[^]*?class="number">([^<]+)', 'i');
                const match = html.match(regex);
                if (match) {
                    let val = match[1].trim().replace(/,/g, '');
                    // Sanity check: Growth percentages are rarely over 500. 
                    // If it's huge, it's likely a total figure (like total Sales), so we skip it.
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

        // Scoring logic (Strictly 0, 10, 20)
        const scoreVal = (val, h, m) => {
            const n = parseFloat(val);
            if (isNaN(n)) return 10; // Neutral if data missing
            return n >= h ? 20 : (n >= m ? 10 : 0);
        };

        const peVal = parseFloat(pe);
        const deVal = parseFloat(debtEquity);

        const factors = {
            revenueGrowth: { 
                value: salesGrowth !== "N/A" ? salesGrowth : "N/A", 
                score: scoreVal(salesGrowth, 15, 5),
                explanation: "Measures sales increase. >15 is Excellent (20), 5-15 is Good (10), <5 is Weak (0)."
            },
            profitGrowth: { 
                value: profitGrowth !== "N/A" ? profitGrowth : "N/A", 
                score: scoreVal(profitGrowth, 15, 5),
                explanation: "Measures net income growth. >15 is Strong (20), 5-15 is Stable (10), <5 is Poor (0)."
            },
            debtEquity: { 
                value: debtEquity, 
                score: isNaN(deVal) ? 10 : (deVal < 0.5 ? 20 : (deVal <= 1.5 ? 10 : 0)),
                explanation: "Debt to Equity ratio. <0.5 is Safe (20), 0.5-1.5 is Moderate (10), >1.5 is High Risk (0)."
            },
            peRatio: { 
                value: pe, 
                score: isNaN(peVal) ? 10 : (peVal < 15 ? 20 : (peVal <= 30 ? 10 : 0)),
                explanation: "Price-to-Earnings. <15 is Cheap (20), 15-30 is Fair (10), >30 is Expensive (0)."
            },
            roe: { 
                value: roe !== "N/A" ? roe : "N/A", 
                score: scoreVal(roe, 15, 10),
                explanation: "Return on Equity. >15 is Efficient (20), 10-15% is Average (10), <10 is Inefficient (0)."
            }
        };

        const sipVal = (parseFloat(roe) > 15 && parseFloat(salesGrowth) > 10 && deVal < 1.0) ? "Excellent" : (parseFloat(roe) > 10 || parseFloat(salesGrowth) > 5 ? "Good" : "Average");
        const sipExplanation = sipVal === "Excellent" ? "Strong growth, high efficiency, and low debt make this a perfect candidate for monthly accumulation." : (sipVal === "Good" ? "Decent fundamentals. Suitable for SIP with cautious monitoring." : "Weak compounding potential. Better for tactical trades than long-term SIP.");

        const companyStats = {
            marketCap: marketCap !== "N/A" ? marketCap : "N/A",
            divYield: divYield !== "N/A" ? divYield : "N/A",
            bookValue: bookValue !== "N/A" ? bookValue : "N/A",
            faceValue: faceValue !== "N/A" ? faceValue : "N/A",
            sipSuitability: sipVal,
            sipExplanation: sipExplanation
        };

        const totalScore = Object.values(factors).reduce((acc, f) => acc + f.score, 0);

        let rating = "Sell";
        let ratingExplanation = "This stock has weak fundamentals. High risk involved.";
        if (totalScore >= 70) {
            rating = "Strong Buy";
            ratingExplanation = "Excellent fundamentals with strong growth and healthy debt levels. Great for investment.";
        } else if (totalScore >= 40) {
            rating = "Hold";
            ratingExplanation = "Moderate performance. The company is stable but has some areas for improvement. Wait for better signals.";
        }

        return {
            name: company.name,
            sector: "Real-time Market",
            price: price !== "N/A" ? price : "0.00",
            factors,
            companyStats,
            totalScore,
            rating,
            ratingExplanation
        };

    } catch (error) {
        throw error;
    }
}


// ROUTES

app.get('/api/stock/:ticker', async (req, res) => {
    try {
        const ticker = req.params.ticker.toUpperCase();
        const userId = req.query.userId;
        console.log(`\n🔍 Searching: ${ticker} (User: ${userId || "Guest"})`);

        const data = await getStockData(ticker);
        
        // Save to DB with User ID if available
        if (userId && userId !== "null") {
            await History.create({ ticker, name: data.name, userId });
        }

        console.log(`✅ Success: ${ticker} - Score: ${data.totalScore}`);
        res.json(data);

    } catch (error) {
        console.error(`❌ Error fetching ${req.params.ticker}:`, error.message);
        res.status(404).json({ error: error.message });
    }
});

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

// ==========================================
const PORT = 5001; // Using 5001 to avoid EADDRINUSE on 5000
app.listen(PORT, () => {
    console.log(`🚀 Universal Stock Server running at http://localhost:${PORT}`);
    console.log(`📊 Works for both Indian (ZOMATO, RELIANCE) and US stocks!`);
});