const express = require('express');
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  createItem,
  getItems,
  getItemByCode,
  updateItemByCode,
  deleteItemByCode,
  bulkUpdateItems,
  getItemHistory,
} = require('../controllers/itemController');

const router = express.Router();

router.post('/', createItem);
router.post('/bulk-update', bulkUpdateItems);
router.get('/', getItems);

// 🟢 use :code instead of :id
router.get('/:code/history', getItemHistory);
router.get('/:code', getItemByCode);
router.put('/:code', updateItemByCode);
router.delete("/:code", protect, authorize("developer"), deleteItemByCode);

module.exports = router;
