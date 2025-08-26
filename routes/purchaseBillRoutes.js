const express = require('express');
const router = express.Router();

const {
  createPurchaseBill,
  getPurchaseBills,
  getPurchaseBillById,
  updatePurchaseBill,
  deletePurchaseBill,
} = require('../controllers/purchaseBillController');

router.post('/', createPurchaseBill);
router.get('/', getPurchaseBills);
router.get('/:id', getPurchaseBillById);
router.put('/:id', updatePurchaseBill);
router.delete('/:id', deletePurchaseBill);

module.exports = router;
