# StockIQ Mini Project (Full Stack)

This is a mini project for a Stock Recommendation System. It uses HTML, CSS, and JavaScript for the frontend, and Node.js + Express + MongoDB for the backend.

## Files Included

1.  `index.html` - The home page with a search bar.
2.  `recommendation.html` - The results page showing the company overview, 5 factor scores, and the final BUY/HOLD/SELL recommendation.
3.  `style.css` - The complete dark theme styling.
4.  `script.js` - The frontend logic to handle search, fetch data from the backend, and calculate the score.
5.  `backend/package.json` - Backend dependencies.
6.  `backend/server.js` - The Node.js server that uses the Yahoo Finance API and saves search history to MongoDB.

## How it Works

*   The frontend uses `fetch()` to call our backend API (`http://localhost:5000/api/stock/TICKER`).
*   The backend receives the request and does two things:
    1.  **Database**: It saves the searched ticker to a local MongoDB database.
    2.  **API**: It uses the free `yahoo-finance2` package to get *real* financial data from Yahoo Finance.
*   The backend calculates the score and sends it back to the frontend.
*   **Fallback Feature**: If the backend server is not running or fails, the frontend automatically falls back to *Mock Data* so your presentation won't crash!


