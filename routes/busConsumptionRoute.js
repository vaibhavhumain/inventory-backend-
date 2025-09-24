const express = require('express');
const router = express.Router();
const busConsumptionController = require('../controllers/busConsumptionController');

router.post('/', busConsumptionController.createBusConsumption);
router.get('/', busConsumptionController.getBusConsumptions);

module.exports = router;
