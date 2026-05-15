// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:5001' 
    : 'https://stock-recomendation.onrender.com';

// Mock Data Database (Fallback if backend is offline)
const mockStockData = {
    "RELIANCE": {
        name: "Reliance Industries",
        sector: "Energy / Retail",
        price: "2950.50",
        factors: {
            revenueGrowth: { value: "18", score: 20, explanation: "Measures sales increase. >15% is Excellent (20), 5-15% is Good (10), <5% is Weak (0)." },
            profitGrowth: { value: "12", score: 10, explanation: "Measures net income growth. >15% is Strong (20), 5-15% is Stable (10), <5% is Poor (0)." },
            debtEquity: { value: "0.41", score: 20, explanation: "Debt to Equity ratio. <0.5 is Safe (20), 0.5-1.5 is Moderate (10), >1.5 is High Risk (0)." },
            peRatio: { value: "28.4", score: 10, explanation: "Price-to-Earnings. <15 is Cheap (20), 15-30 is Fair (10), >30 is Expensive (0)." },
            roe: { value: "9.8", score: 0, explanation: "Return on Equity. >15% is Efficient (20), 10-15% is Average (10), <10% is Inefficient (0)." }
        },
        ratingExplanation: "Strong fundamentals but slightly overvalued P/E and low ROE makes it a Hold.",
        totalScore: 60
    },
    "TCS": {
        name: "Tata Consultancy Services",
        sector: "IT Services",
        price: "3890.20",
        factors: {
            revenueGrowth: { value: "16", score: 20, explanation: "Measures sales increase. >15% is Excellent (20), 5-15% is Good (10), <5% is Weak (0)." },
            profitGrowth: { value: "22", score: 20, explanation: "Measures net income growth. >15% is Strong (20), 5-15% is Stable (10), <5% is Poor (0)." },
            debtEquity: { value: "0.05", score: 20, explanation: "Debt to Equity ratio. <0.5 is Safe (20), 0.5-1.5 is Moderate (10), >1.5 is High Risk (0)." },
            peRatio: { value: "31.2", score: 0, explanation: "Price-to-Earnings. <15 is Cheap (20), 15-30 is Fair (10), >30 is Expensive (0)." },
            roe: { value: "45.6", score: 20, explanation: "Return on Equity. >15% is Efficient (20), 10-15% is Average (10), <10% is Inefficient (0)." }
        },
        ratingExplanation: "Exceptional efficiency and growth. Highly recommended despite the premium valuation.",
        totalScore: 80
    }
};

// Search from Index page
function searchStock() {
    let input = document.getElementById("searchInput").value.toUpperCase().trim();
    if (input === "") {
        alert("Please enter a stock ticker (e.g. RELIANCE).");
        return;
    }
    const userId = localStorage.getItem("userId");
    window.location.href = `recommendation.html?ticker=${input}&userId=${userId}`;
}

// Redirect to recommendation page
function goToStock(ticker) {
    const userId = localStorage.getItem("userId");
    window.location.href = `recommendation.html?ticker=${ticker}&userId=${userId}`;
}

// User Auth Check
function checkLogin() {
    const userId = localStorage.getItem("userId");
    const username = localStorage.getItem("username");
    const userNav = document.getElementById("userNav");

    if (userNav) {
        if (userId && username) {
            userNav.innerHTML = `
                <div class="user-badge">
                    <span>Hi, <b>${username}</b></span>
                    <button onclick="logout()" class="logout-btn">Logout</button>
                </div>
            `;
        }
    }
}

function logout() {
    localStorage.removeItem("userId");
    localStorage.removeItem("username");
    window.location.reload();
}


// Load data on Recommendation page
async function loadStockDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const ticker = urlParams.get('ticker');
    const userId = urlParams.get('userId') || localStorage.getItem("userId");

    if (!ticker) {
        document.getElementById("stockName").innerText = "No stock selected.";
        return;
    }

    // Set initial state
    document.getElementById("stockName").innerText = `${ticker}`;

    try {
        const response = await fetch(`${API_BASE_URL}/api/stock/${ticker}?userId=${userId}`);
        if (!response.ok) throw new Error("Stock not found");
        const data = await response.json();
        updateUI(ticker, data);
    } catch (error) {
        console.log("Falling back to mock data...");
        let data = mockStockData[ticker];
        if (!data) {
            data = {
                name: ticker + " Ltd.",
                sector: "Unknown / Diversified",
                price: (Math.random() * 2000 + 100).toFixed(2),
                factors: {
                    revenueGrowth: { value: "N/A", score: 0, explanation: "No data available." },
                    profitGrowth: { value: "N/A", score: 0, explanation: "No data available." },
                    debtEquity: { value: "N/A", score: 0, explanation: "No data available." },
                    peRatio: { value: "N/A", score: 0, explanation: "No data available." },
                    roe: { value: "N/A", score: 0, explanation: "No data available." }
                },
                ratingExplanation: "No real-time data found for this ticker."
            };
        }
        updateUI(ticker, data);
    }
}

// Update UI function
function updateUI(ticker, data) {
    // Helper: safely update text if element exists
    const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) {
            // Format numbers if they look like numbers
            let displayVal = val;
            if (!isNaN(val) && val !== "" && val !== null && val !== "N/A") {
                displayVal = parseFloat(val).toFixed(2);
            }
            
            el.innerText = displayVal;
            
            // Add 'na' class if value is N/A
            if (displayVal === "N/A") {
                el.classList.add("na");
            } else {
                el.classList.remove("na");
            }
        }
    };

    // Helper: safely get a numeric score
    const safeScore = (s) => (typeof s === 'number' ? s : 0);

    // Update UI Elements
    setTxt("stockName", ticker);
    setTxt("stockNameHero", data.name);
    setTxt("sector", data.sector || "N/A");
    setTxt("price", data.price);

    // Factors (Score Only now as per user request to remove 'middle column')
    setTxt("revScore", data.factors.revenueGrowth.score);
    setTxt("profitScore", data.factors.profitGrowth.score);
    setTxt("debtScore", data.factors.debtEquity.score);
    setTxt("peScore", data.factors.peRatio.score);
    setTxt("roeScore", data.factors.roe.score);

    // Company Stats (The new trusted data)
    if (data.companyStats) {
        setTxt("marketCap", data.companyStats.marketCap);
        setTxt("divYield", data.companyStats.divYield);
        setTxt("bookValue", data.companyStats.bookValue);
        setTxt("faceValue", data.companyStats.faceValue);
        setTxt("sipSuitability", data.companyStats.sipSuitability);

        // Display SIP Explanation
        const sipExpContainer = document.getElementById("sipExplanationContainer");
        const sipExpText = document.getElementById("sipExplanation");
        if (sipExpContainer && sipExpText && data.companyStats.sipExplanation) {
            sipExpText.innerText = data.companyStats.sipExplanation;
            sipExpContainer.style.display = "block";
        } else if (sipExpContainer) {
            sipExpContainer.style.display = "none";
        }
    }

    // Rating Reason
    setTxt("ratingReason", data.ratingExplanation || "");

    // Calculate Total Score
    let total = data.totalScore;
    if (total == null) {
        total = safeScore(data.factors.revenueGrowth.score) +
                safeScore(data.factors.profitGrowth.score) +
                safeScore(data.factors.debtEquity.score) +
                safeScore(data.factors.peRatio.score) +
                safeScore(data.factors.roe.score);
    }

    animateScore(total);
    
    // Store data globally for timeframe switching
    window.currentStockData = data;
    window.currentTicker = ticker;
    
    // Initialize timeframe signals
    switchTimeframe('Daily');
    
    // Initialize TradingView Chart
    initTradingView(ticker);
}

function initTradingView(ticker) {
    const chartContainer = document.getElementById("tradingview_widget");
    const taContainer = document.getElementById("tradingview_ta_widget");
    
    if (!chartContainer) return;

    // Formatting symbol for TradingView
    let symbol = ticker;
    if (!ticker.includes(":")) {
        symbol = `NSE:${ticker}`;
    }

    // 1. Advanced Real-Time Chart using direct IFRAME
    // This is the most bulletproof way to avoid the AAPL fallback issue
    chartContainer.innerHTML = ""; 
    const iframe = document.createElement("iframe");
    
    // Construct the URL for the TradingView Widget
    const theme = "dark";
    const timezone = "Asia/Kolkata";
    const interval = "D";
    
    // Official TradingView widget embed URL
    iframe.src = `https://www.tradingview.com/widgetembed/?symbol=${symbol}&interval=${interval}&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f1f3f6&theme=${theme}&style=1&timezone=${timezone}`;
    
    iframe.width = "100%";
    iframe.height = "450";
    iframe.style.border = "none";
    iframe.style.borderRadius = "8px";
    
    chartContainer.appendChild(iframe);

    // 2. Technical Analysis Summary
    if (taContainer) {
        taContainer.innerHTML = ""; 
        const taWrapper = document.createElement("div");
        taWrapper.className = "tradingview-widget-container";
        const taWidgetDiv = document.createElement("div");
        taWidgetDiv.className = "tradingview-widget-container__widget";
        taWrapper.appendChild(taWidgetDiv);

        const taScript = document.createElement("script");
        taScript.src = "https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js";
        taScript.type = "text/javascript";
        taScript.async = true;
        taScript.innerHTML = JSON.stringify({
            "interval": "1D",
            "width": "100%",
            "isTransparent": false,
            "height": "400",
            "symbol": symbol,
            "showIntervalTabs": true,
            "locale": "en",
            "colorTheme": "dark"
        });
        
        taWrapper.appendChild(taScript);
        taContainer.appendChild(taWrapper);
    }
}

function switchTimeframe(timeframe) {
    // Update tab UI
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        if (btn.innerText === timeframe) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const badge = document.getElementById("signalBadge");
    const pointsEl = document.getElementById("signalPoints");
    const description = document.getElementById("signalDescription");
    const data = window.currentStockData;
    
    if (!data) return;
    
    const score = data.totalScore;
    let signal = "HOLD";
    let desc = "";
    let points = 0;

    // Logic based on timeframe and fundamental score
    if (timeframe === 'Daily') {
        points = Math.min(10, (score * 0.08 + 2).toFixed(1));
        if (points >= 8.5) { signal = "STRONG BUY"; }
        else if (points >= 6.5) { signal = "BUY"; }
        else if (points >= 4.5) { signal = "HOLD"; }
        else { signal = "SELL"; }
        desc = "Based on intraday momentum. High risk/reward.";
    } else if (timeframe === 'Weekly') {
        points = Math.min(10, (score * 0.09 + 1).toFixed(1));
        if (points >= 7.5) { signal = "BUY"; }
        else if (points >= 5.0) { signal = "HOLD"; }
        else { signal = "SELL"; }
        desc = "Short-term swing trade potential.";
    } else if (timeframe === 'Monthly') {
        points = (score * 0.1).toFixed(1);
        if (points >= 7.0) { signal = "BUY"; }
        else if (points >= 4.5) { signal = "HOLD"; }
        else { signal = "SELL"; }
        desc = "Aligned with quarterly expectations.";
    } else if (timeframe === 'Yearly') {
        points = (score * 0.1).toFixed(1);
        if (points >= 6.5) { signal = "BUY"; }
        else if (points >= 3.5) { signal = "HOLD"; }
        else { signal = "SELL"; }
        desc = "Solid fundamentals for wealth creation.";
    }

    badge.innerText = signal;
    if (pointsEl) pointsEl.innerText = points;
    badge.className = `badge small ${signal.includes("BUY") ? "BUY" : (signal.includes("SELL") ? "SELL" : "HOLD")}`;
    description.innerText = desc;
}

function animateScore(targetScore) {
    let currentScore = 0;
    const scoreElement = document.getElementById("totalScore");
    const interval = setInterval(() => {
        if (currentScore >= targetScore) {
            clearInterval(interval);
            scoreElement.innerText = targetScore;
            showBadge(targetScore);
        } else {
            currentScore++;
            scoreElement.innerText = currentScore;
        }
    }, 15);
}

function showBadge(total) {
    let badge = document.getElementById("recommendationBadge");
    if (total >= 70) {
        badge.innerText = "BUY";
        badge.className = "badge BUY";
    } else if (total >= 40) {
        badge.innerText = "HOLD";
        badge.className = "badge HOLD";
    } else {
        badge.innerText = "SELL";
        badge.className = "badge SELL";
    }
}

// Load Search History
async function loadHistory() {
    const historyList = document.getElementById("historyList");
    const clearBtn = document.getElementById("clearAllBtn");
    if (!historyList) return;

    const userId = localStorage.getItem("userId");
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/history?userId=${userId}`);
        const data = await response.json();

        historyList.innerHTML = "";
        if (!data || data.length === 0) {
            historyList.innerHTML = "<p style='color: #666;'>No history yet. Start searching!</p>";
            if (clearBtn) clearBtn.style.display = "none";
            return;
        }

        if (clearBtn && userId) clearBtn.style.display = "block";

        data.forEach(item => {
            const card = document.createElement("div");
            card.className = "history-card";
            card.onclick = () => goToStock(item.ticker);
            card.innerHTML = `
                <h4>${item.ticker}</h4>
                <p>${item.name || ""}</p>
                <small>${new Date(item.timestamp).toLocaleTimeString()}</small>
                ${userId ? `<button class="delete-single-btn" title="Delete">×</button>` : ''}
            `;
            
            // Add delete functionality
            const delBtn = card.querySelector(".delete-single-btn");
            if (delBtn) {
                delBtn.onclick = (e) => {
                    e.stopPropagation(); // Don't redirect
                    deleteHistoryItem(item._id);
                };
            }

            historyList.appendChild(card);
        });
    } catch (error) {
        console.error("Error loading history:", error);
    }
}

async function deleteHistoryItem(id) {
    const userId = localStorage.getItem("userId");
    try {
        await fetch(`${API_BASE_URL}/api/history/${id}?userId=${userId}`, { method: 'DELETE' });
        loadHistory(); // Refresh
    } catch (err) {
        alert("Failed to delete item");
    }
}

async function clearAllHistory() {
    if (!confirm("Are you sure you want to clear all history?")) return;
    const userId = localStorage.getItem("userId");
    try {
        await fetch(`${API_BASE_URL}/api/history/all?userId=${userId}`, { method: 'DELETE' });
        loadHistory(); // Refresh
    } catch (err) {
        alert("Failed to clear history");
    }
}

// Enter key to search and initialization
document.addEventListener("DOMContentLoaded", () => {
    checkLogin();
    loadHistory();
    
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("keypress", function(event) {
            if (event.key === "Enter") {
                event.preventDefault();
                searchStock();
            }
        });
    }
});
