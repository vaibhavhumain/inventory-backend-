const express = require('express');
const router = express.Router();

const {
  createPurchaseInvoice,
  getPurchaseInvoices,
  getPurchaseInvoiceById,
  updatePurchaseInvoice,
  deletePurchaseInvoice,
  getInvoiceReport,
} = require('../controllers/purchaseInvoiceController');

router.post('/', createPurchaseInvoice);
router.get('/', getPurchaseInvoices);
router.get('/report', getInvoiceReport);
router.get('/:id', getPurchaseInvoiceById);
router.put('/:id', updatePurchaseInvoice);
router.delete('/:id', deletePurchaseInvoice);

module.exports = router;
