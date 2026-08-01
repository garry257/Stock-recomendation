const express = require('express');
const router = express.Router();
const { getStockInfo } = require('../controllers/stockController');

router.get('/:ticker', getStockInfo);

module.exports = router;
