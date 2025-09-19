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
  addSupplierToItem,
} = require('../controllers/itemController');

const router = express.Router();

router.post('/', createItem);
router.post('/bulk-update', bulkUpdateItems);
router.post('/:code/suppliers',addSupplierToItem);
router.get('/', getItems);
router.get('/:code', getItemByCode);
router.put('/:code', updateItemByCode);
router.delete("/:code", protect, authorize("developer"), deleteItemByCode);

module.exports = router;
