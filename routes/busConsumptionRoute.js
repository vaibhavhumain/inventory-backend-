const express = require('express');
const router = express.Router();
const busConsumptionController = require('../controllers/busConsumptionController');

router.post('/', busConsumptionController.createBusConsumption);
router.get('/', busConsumptionController.getBusConsumptions);
router.get('/:id', busConsumptionController.getBusConsumptionById);

module.exports = router;
