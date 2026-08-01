const express = require('express');
const router = express.Router();
const { getHistory, clearAllHistory, deleteHistoryItem } = require('../controllers/historyController');

router.get('/', getHistory);
router.delete('/all', clearAllHistory);
router.delete('/:id', deleteHistoryItem);

module.exports = router;
