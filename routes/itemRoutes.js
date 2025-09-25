const express = require('express');
const { createItem, getItems, deleteItem, getItemOverview } = require('../controllers/itemController');
const router = express.Router();

router.post('/', createItem);
router.get('/', getItems);
router.delete('/:id', deleteItem);
router.get("/:id/overview", getItemOverview);

module.exports = router;
