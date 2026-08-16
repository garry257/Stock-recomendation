// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
    ? 'http://localhost:5005'
    : window.location.origin;

let currentTimeframe = '1d';



// --- Tab Navigation Logic ---
function switchTab(tabName) {
    const fundView = document.getElementById("fundamentalView");
    const techView = document.getElementById("technicalView");
    const btnFund = document.getElementById("btnFund");
    const btnTech = document.getElementById("btnTech");

    if (tabName === 'fundamental') {
        fundView.style.display = 'block';
        techView.style.display = 'none';
        btnFund.style.background = 'var(--accent)';
        btnFund.style.color = 'white';
        btnFund.style.boxShadow = '0 4px 12px rgba(108, 99, 255, 0.4)';
        btnTech.style.background = 'transparent';
        btnTech.style.color = '#888';
        btnTech.style.boxShadow = 'none';
    } else {
        fundView.style.display = 'none';
        techView.style.display = 'block';
        btnTech.style.background = 'var(--accent)';
        btnTech.style.color = 'white';
        btnTech.style.boxShadow = '0 4px 12px rgba(108, 99, 255, 0.4)';
        btnFund.style.background = 'transparent';
        btnFund.style.color = '#888';
        btnFund.style.boxShadow = 'none';
    }
}

// Mock Data Database (Fallback if backend is offline)
const mockStockData = {
    "RELIANCE": {
        name: "Reliance Industries",
        sector: "Energy / Retail",
        price: "2950.50",
        factors: {
            revenueGrowth: { value: "18", score: 20 },
            profitGrowth: { value: "12", score: 10 },
            debtEquity: { value: "0.41", score: 20 },
            peRatio: { value: "28.4", score: 10 },
            roe: { value: "9.8", score: 0 }
        },
        ratingExplanation: "Strong fundamentals but slightly overvalued.",
        totalScore: 60,
        indicators: {
            rsi: "55.0", macdLine: "12.5", macdSignal: "10.0", macdHist: "2.5",
            signal: "HOLD", explanation: "Mock indicator data."
        }
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
        const response = await fetch(`${API_BASE_URL}/api/stock/${ticker}?userId=${userId}&timeframe=${currentTimeframe}`);
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
                    revenueGrowth: { value: "N/A", score: 0 },
                    profitGrowth: { value: "N/A", score: 0 },
                    debtEquity: { value: "N/A", score: 0 },
                    peRatio: { value: "N/A", score: 0 },
                    roe: { value: "N/A", score: 0 }
                },
                totalScore: 0,
                ratingExplanation: "No real-time data found for this ticker."
            };
        }
        updateUI(ticker, data);
    }
}

// Update UI function
function updateUI(ticker, data) {
    const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) {
            let displayVal = val;
            if (!isNaN(val) && val !== "" && val !== null && val !== "N/A") {
                displayVal = parseFloat(val).toFixed(2);
            }
            
            el.innerText = displayVal;
            
            if (displayVal === "N/A") el.classList.add("na");
            else el.classList.remove("na");
        }
    };

    const safeScore = (s) => (typeof s === 'number' ? s : 0);

    // Update Header Elements
    const resolvedSymbol = data.ticker || ticker;
    setTxt("stockName", resolvedSymbol);
    setTxt("stockNameHero", data.name);
    setTxt("sector", data.sector || "N/A");
    setTxt("price", data.price);

    // Factors
    if (data.factors) {
        setTxt("revScore", data.factors.revenueGrowth.score);
        setTxt("profitScore", data.factors.profitGrowth.score);
        setTxt("debtScore", data.factors.debtEquity.score);
        setTxt("peScore", data.factors.peRatio.score);
        setTxt("roeScore", data.factors.roe.score);
    }

    // Company Stats
    if (data.companyStats) {
        setTxt("marketCap", data.companyStats.marketCap);
        setTxt("divYield", data.companyStats.divYield);
        setTxt("bookValue", data.companyStats.bookValue);
        setTxt("faceValue", data.companyStats.faceValue);
        setTxt("sipSuitability", data.companyStats.sipSuitability);

        const sipExpContainer = document.getElementById("sipExplanationContainer");
        const sipExpText = document.getElementById("sipExplanation");
        if (sipExpContainer && sipExpText && data.companyStats.sipExplanation) {
            sipExpText.innerText = data.companyStats.sipExplanation;
            sipExpContainer.style.display = "block";
        } else if (sipExpContainer) {
            sipExpContainer.style.display = "none";
        }
    }

    setTxt("ratingReason", data.ratingExplanation || "");

    // Technical Indicators (RSI & MACD) — with plain-English meanings
    if (data.indicators) {
        const rsi = parseFloat(data.indicators.rsi);
        const macdL = parseFloat(data.indicators.macdLine);
        const macdS = parseFloat(data.indicators.macdSignal);
        const hist = parseFloat(data.indicators.macdHist);

        setTxt("rsiValue", data.indicators.rsi);
        setTxt("macdLine", data.indicators.macdLine);
        setTxt("macdSignal", data.indicators.macdSignal);
        setTxt("macdHist", data.indicators.macdHist);
        setTxt("strategySignalText", `[${data.indicators.signal}] ${data.indicators.explanation}`);

        // --- RSI meaning ---
        const rsiEl = document.getElementById("rsiMeaning");
        if (rsiEl) {
            if (rsi < 30) {
                rsiEl.textContent = "⬇ Oversold — stock is beaten down, possible bounce ahead";
                rsiEl.className = "indicator-meaning bullish";
            } else if (rsi < 45) {
                rsiEl.textContent = "📉 Slightly weak — recovering from a dip";
                rsiEl.className = "indicator-meaning bullish";
            } else if (rsi <= 60) {
                rsiEl.textContent = "⚖ Neutral zone — no extreme, wait for clearer setup";
                rsiEl.className = "indicator-meaning neutral";
            } else if (rsi <= 70) {
                rsiEl.textContent = "📈 Getting hot — price may be running up fast";
                rsiEl.className = "indicator-meaning bearish";
            } else {
                rsiEl.textContent = "🔴 Overbought — stock rallied too much, risk of pullback";
                rsiEl.className = "indicator-meaning bearish";
            }
        }

        // --- MACD Line meaning ---
        const macdLineEl = document.getElementById("macdLineMeaning");
        if (macdLineEl) {
            if (macdL > 0) {
                macdLineEl.textContent = "✅ Positive — upward momentum is active";
                macdLineEl.className = "indicator-meaning bullish";
            } else {
                macdLineEl.textContent = "🔻 Negative — downward momentum is active";
                macdLineEl.className = "indicator-meaning bearish";
            }
        }

        // --- MACD Signal meaning ---
        const macdSigEl = document.getElementById("macdSignalMeaning");
        if (macdSigEl) {
            if (macdL > macdS) {
                macdSigEl.textContent = "🟢 MACD above Signal — bullish crossover (BUY zone)";
                macdSigEl.className = "indicator-meaning bullish";
            } else if (macdL < macdS) {
                macdSigEl.textContent = "🔴 MACD below Signal — bearish crossover (SELL zone)";
                macdSigEl.className = "indicator-meaning bearish";
            } else {
                macdSigEl.textContent = "⚖ Lines are equal — no clear direction";
                macdSigEl.className = "indicator-meaning neutral";
            }
        }

        // --- Histogram meaning ---
        const histEl = document.getElementById("macdHistMeaning");
        if (histEl) {
            if (hist > 0) {
                histEl.textContent = "📊 Positive — buying pressure is stronger than selling";
                histEl.className = "indicator-meaning bullish";
            } else if (hist < 0) {
                histEl.textContent = "📊 Negative — selling pressure is stronger than buying";
                histEl.className = "indicator-meaning bearish";
            } else {
                histEl.textContent = "⚖ Flat — momentum is balanced";
                histEl.className = "indicator-meaning neutral";
            }
        }
    } else {
        setTxt("strategySignalText", "Unable to load technical indicators.");
    }

    // Trade Setup Panel
    const setupPanel = document.getElementById("tradeSetupPanel");
    const acceptBtn = document.getElementById("acceptTradeBtn");
    const acceptedNote = document.getElementById("acceptedNote");
    const resolutionEl = document.getElementById("tradeResolution");

    const tradeKey = `acceptedTrade_${resolvedSymbol}_${currentTimeframe}`;
    function getAcceptedTrade() {
        try { return JSON.parse(localStorage.getItem(tradeKey)); } catch (e) { return null; }
    }
    function setAcceptedTrade(obj) { localStorage.setItem(tradeKey, JSON.stringify(obj)); }
    function clearAcceptedTrade() { localStorage.removeItem(tradeKey); }

    const acceptedTrade = getAcceptedTrade();

    // If user previously accepted this trade, keep it locked until win/loss
    if (acceptedTrade && acceptedTrade.ticker === resolvedSymbol && acceptedTrade.timeframe === currentTimeframe) {
        setTxt("setupEntry", acceptedTrade.entry);
        setTxt("setupTarget", acceptedTrade.target);
        setTxt("setupStopLoss", acceptedTrade.stopLoss);

        const currentPrice = parseFloat(data.price);
        const entry = parseFloat(acceptedTrade.entry);
        const target = parseFloat(acceptedTrade.target);
        const stopLoss = parseFloat(acceptedTrade.stopLoss);
        const isBuy = target > entry;

        let outcome = "TRADE ACTIVE";
        let outcomeColor = "#fff";
        if (isBuy) {
            if (currentPrice >= target) { outcome = "WIN"; outcomeColor = "var(--green)"; }
            else if (currentPrice <= stopLoss) { outcome = "LOSS"; outcomeColor = "var(--red)"; }
        } else {
            if (currentPrice <= target) { outcome = "WIN"; outcomeColor = "var(--green)"; }
            else if (currentPrice >= stopLoss) { outcome = "LOSS"; outcomeColor = "var(--red)"; }
        }

        const outcomeEl = document.getElementById("tradeOutcome");
        if (outcomeEl) { outcomeEl.innerText = outcome; outcomeEl.style.color = outcomeColor; }

        if (acceptBtn) acceptBtn.style.display = "none";
        if (acceptedNote) acceptedNote.style.display = "inline-block";

        // Show descriptive resolution and clear accepted trade after resolution
        if (outcome === "WIN" || outcome === "LOSS") {
            if (resolutionEl) {
                if (outcome === "WIN") resolutionEl.innerText = "Target hit — trade closed (WIN)";
                else resolutionEl.innerText = "Stop loss hit — trade closed (LOSS)";
                resolutionEl.style.display = "inline-block";
            }
            clearAcceptedTrade();
            if (acceptedNote) acceptedNote.style.display = "none";
            setTimeout(() => alert(`Accepted trade ${outcome} for ${resolvedSymbol}`), 50);
        } else {
            if (resolutionEl) { resolutionEl.style.display = "none"; resolutionEl.innerText = ""; }
        }

        if (setupPanel) setupPanel.style.display = "block";
    } else if (data.tradeSetup && data.indicators && (data.indicators.signal === "BUY" || data.indicators.signal === "SELL")) {
        // Show suggested trade and allow user to accept it. Do not show suggestions for HOLD.
        setTxt("setupEntry", data.tradeSetup.entry);
        setTxt("setupTarget", data.tradeSetup.target);
        setTxt("setupStopLoss", data.tradeSetup.stopLoss);

        if (acceptBtn) {
            acceptBtn.style.display = "inline-block";
            acceptBtn.onclick = () => {
                const toAccept = {
                    ticker: resolvedSymbol,
                    timeframe: currentTimeframe,
                    entry: data.tradeSetup.entry,
                    target: data.tradeSetup.target,
                    stopLoss: data.tradeSetup.stopLoss,
                    signal: data.indicators.signal,
                    acceptedAt: Date.now()
                };
                setAcceptedTrade(toAccept);
                acceptBtn.style.display = "none";
                if (acceptedNote) acceptedNote.style.display = "inline-block";
                const outcomeEl = document.getElementById("tradeOutcome");
                if (outcomeEl) { outcomeEl.innerText = "TRADE ACTIVE"; outcomeEl.style.color = "#fff"; }
                if (resolutionEl) { resolutionEl.style.display = "none"; resolutionEl.innerText = ""; }
            };
        }
        if (acceptedNote) acceptedNote.style.display = "none";

        // Tentative outcome (suggested only)
        const currentPrice = parseFloat(data.price);
        const entry = parseFloat(data.tradeSetup.entry);
        const target = parseFloat(data.tradeSetup.target);
        const stopLoss = parseFloat(data.tradeSetup.stopLoss);
        const isBuy = target > entry;
        let outcome = "TRADE SUGGESTED";
        let outcomeColor = "#fff";
        if (isBuy) {
            if (currentPrice >= target) { outcome = "WIN"; outcomeColor = "var(--green)"; }
            else if (currentPrice <= stopLoss) { outcome = "LOSS"; outcomeColor = "var(--red)"; }
        } else {
            if (currentPrice <= target) { outcome = "WIN"; outcomeColor = "var(--green)"; }
            else if (currentPrice >= stopLoss) { outcome = "LOSS"; outcomeColor = "var(--red)"; }
        }
        const outcomeEl = document.getElementById("tradeOutcome");
        if (outcomeEl) { outcomeEl.innerText = outcome; outcomeEl.style.color = outcomeColor; }

        // Show explanatory message when suggested trade reaches target or stoploss
        if (resolutionEl) {
            if (outcome === "WIN") { resolutionEl.innerText = "Target reached — suggested trade would have closed (WIN)"; resolutionEl.style.display = "inline-block"; }
            else if (outcome === "LOSS") { resolutionEl.innerText = "Stop loss reached — suggested trade would have closed (LOSS)"; resolutionEl.style.display = "inline-block"; }
            else { resolutionEl.style.display = "none"; resolutionEl.innerText = ""; }
        }

        if (setupPanel) setupPanel.style.display = "block";
    } else {
        if (setupPanel) setupPanel.style.display = "none";
        if (acceptBtn) acceptBtn.style.display = "none";
        if (acceptedNote) acceptedNote.style.display = "none";
    }

    // Total Score
    let total = data.totalScore;
    if (total == null && data.factors) {
        total = safeScore(data.factors.revenueGrowth.score) +
                safeScore(data.factors.profitGrowth.score) +
                safeScore(data.factors.debtEquity.score) +
                safeScore(data.factors.peRatio.score) +
                safeScore(data.factors.roe.score);
    }

    animateScore(total);
}

function changeTimeframe(tf) {
    currentTimeframe = tf;
    
    // Update UI buttons
    const buttons = document.querySelectorAll('.tf-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
        btn.style.color = '#aaa';
    });
    
    const activeBtn = document.getElementById(`tf-${tf}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.background = 'var(--accent)';
        activeBtn.style.color = 'white';
    }
    
    // Show loading state temporarily
    document.getElementById("strategySignalText").innerText = "Analyzing new timeframe data...";
    document.getElementById("tradeSetupPanel").style.display = "none";
    
    // Reload Data
    loadStockDetails();
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
            
            const delBtn = card.querySelector(".delete-single-btn");
            if (delBtn) {
                delBtn.onclick = (e) => {
                    e.stopPropagation();
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
        loadHistory();
    } catch (err) {
        alert("Failed to delete item");
    }
}

async function clearAllHistory() {
    if (!confirm("Are you sure you want to clear all history?")) return;
    const userId = localStorage.getItem("userId");
    try {
        await fetch(`${API_BASE_URL}/api/history/all?userId=${userId}`, { method: 'DELETE' });
        loadHistory();
    } catch (err) {
        alert("Failed to clear history");
    }
}



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
