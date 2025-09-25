const express = require('express');
const { createItem, getItems, deleteItem, getItemOverview, getItemLedger} = require('../controllers/itemController');
const router = express.Router();

router.post('/', createItem);
router.get('/', getItems);
router.delete('/:id', deleteItem);
router.get("/:id/overview", getItemOverview);
router.get("/:id/ledger", getItemLedger);

module.exports = router;
