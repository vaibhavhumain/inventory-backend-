const express = require('express');
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  createItem,
  getItems,
  getItemById,
  updateItem,
  deleteItem,
  bulkUpdateItems,
} = require('../controllers/itemController');

const router = express.Router();

router.post('/', createItem);
router.post('/bulk-update', bulkUpdateItems);
router.get('/', getItems);
router.get('/:id', getItemById);
router.put('/:id', updateItem);
router.delete("/:id", protect, authorize("developer"), deleteItem);


module.exports = router;
  