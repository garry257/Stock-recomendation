// Imports and setup
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/views')));
app.use('/public', express.static(path.join(__dirname, '../frontend/public')));

// DATABASE CONNECTION
connectDB();

// Routes
app.use('/api', require('./routes/authRoutes'));
app.use('/api/stock', require('./routes/stockRoutes'));
app.use('/api/history', require('./routes/historyRoutes'));

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