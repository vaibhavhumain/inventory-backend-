const express = require('express');
const router = express.Router();
const analysisController = require('../controllers/analysisController');

router.get('/stock-value', analysisController.getStockValue);
router.get('/consumption', analysisController.getConsumptionRate);
router.get('/reorder', analysisController.getReorderPoints);
router.get('/turnover', analysisController.getTurnoverRatios);

module.exports = router;
