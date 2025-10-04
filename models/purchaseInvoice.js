const mongoose = require('mongoose');
const InventoryTransaction = require('./InventoryTransaction');
const Item = require('./item');

// -----------------------------
// Invoice Item Schema
// -----------------------------
const invoiceItemSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    overrideDescription: { type: String },
    headQuantity: { type: Number, required: true },
    headQuantityMeasurement: { type: String, required: true },
    subQuantity: { type: Number, required: true },
    subQuantityMeasurement: { type: String },
    rate: { type: Number, required: true },
    amount: { type: Number },
    gstRate: { type: Number },
    notes: { type: String },

    // ✅ New: store snapshot of item's HSN at the time of purchase
    hsnSnapshot: { type: String },
  },
  { _id: false }
);

// -----------------------------
// Purchase Invoice Schema
// -----------------------------
const purchaseInvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now },

    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    partyName: { type: String, required: true },

    items: [invoiceItemSchema],

    otherChargesBeforeTaxAmount: { type: Number, default: 0 },
    otherChargesBeforeTaxPercent: { type: Number, default: 0 },
    otherChargesBeforeTaxGstRate: { type: Number, default: 0 },

    otherChargesAfterTax: { type: Number, default: 0 },

    totalTaxableValue: { type: Number },
    totalInvoiceValue: { type: Number },
  },
  { timestamps: true }
);

// -----------------------------
// PRE-SAVE HOOK
// -----------------------------
purchaseInvoiceSchema.pre('save', async function (next) {
  try {
    let totalTaxable = 0;
    let gstTotal = 0;

    // ✅ Populate hsnSnapshot automatically from Item model
    for (const item of this.items) {
      const itemDoc = await Item.findById(item.item);
      if (itemDoc?.hsnCode) {
        item.hsnSnapshot = itemDoc.hsnCode;
      }

      // Basic amount calculations
      item.amount = (item.subQuantity || 0) * (item.rate || 0);
      totalTaxable += item.amount;

      if (item.gstRate) {
        gstTotal += (item.amount * item.gstRate) / 100;
      }
    }

    const beforeTaxPercentValue =
      (totalTaxable * (this.otherChargesBeforeTaxPercent || 0)) / 100;
    const beforeTaxFixedValue = this.otherChargesBeforeTaxAmount || 0;
    const beforeTaxTotal = beforeTaxFixedValue + beforeTaxPercentValue;

    const beforeTaxGst =
      (beforeTaxTotal * (this.otherChargesBeforeTaxGstRate || 0)) / 100;

    this.totalTaxableValue = totalTaxable + beforeTaxTotal;
    this.totalInvoiceValue =
      totalTaxable +
      beforeTaxTotal +
      gstTotal +
      beforeTaxGst +
      (this.otherChargesAfterTax || 0);

    next();
  } catch (err) {
    next(err);
  }
});

// -----------------------------
// POST-SAVE HOOK: Inventory Transactions
// -----------------------------
purchaseInvoiceSchema.post('save', async function (doc, next) {
  try {
    // Remove previous inventory transactions for this invoice
    await InventoryTransaction.deleteMany({ 'meta.invoice': doc._id });

    // Insert new transactions for all items
    if (doc.items?.length) {
      const txns = doc.items.map((it) => ({
        item: it.item,
        type: 'PURCHASE',
        quantity: it.subQuantity,
        rate: it.rate || 0,
        amount: (it.subQuantity || 0) * (it.rate || 0),
        date: doc.date,
        meta: { invoice: doc._id },
      }));

      await InventoryTransaction.insertMany(txns);
    }

    return next();
  } catch (err) {
    return next(err);
  }
});

module.exports = mongoose.model('PurchaseInvoice', purchaseInvoiceSchema);
