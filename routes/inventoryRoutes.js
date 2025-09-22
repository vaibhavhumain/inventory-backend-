const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/inventoryController');

router.get('/summary', ctrl.listSummary);
router.post('/issue-to-sub', ctrl.issueToSub);
router.post('/consume', ctrl.consumeFromSub);
router.post('/sell', ctrl.sellFromSub);

module.exports = router;