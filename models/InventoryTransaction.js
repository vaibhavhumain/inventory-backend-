const mongoose = require('mongoose');

const inventoryTransactionSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    type: {
      type: String,
      enum: ['PURCHASE', 'ISSUE_TO_SUB', 'CONSUMPTION', 'SALE'],
      required: true,
    },
    quantity: { type: Number, required: true, min: 0 },

    date: { type: Date, default: Date.now },
    meta: {
      invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseInvoice' },
      bus: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus' }, 
      customer: String, 
      note: String,
    },
  },
  { timestamps: true }
);

inventoryTransactionSchema.index({ item: 1, date: 1 });
inventoryTransactionSchema.index({ 'meta.invoice': 1 });

module.exports = mongoose.model('InventoryTransaction', inventoryTransactionSchema);
