const express = require('express');
const { createItem, getItems, deleteItem } = require('../controllers/itemController');
const router = express.Router();

router.post('/', createItem);
router.get('/', getItems);
router.delete('/:id', deleteItem);
router.get("/:id/overview", itemController.getItemOverview);

module.exports = router;
