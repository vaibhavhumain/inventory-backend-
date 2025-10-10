const mongoose = require('mongoose');
const InventoryTransaction = require('./InventoryTransaction');
const Item = require('./item');

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
    notes: { type: String },
    hsnSnapshot: { type: String },
    gstSnapshot: { type: Number },
  },
  { _id: false }
);

const purchaseInvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    partyName: { type: String, required: true },
    manualInvoiceDate: { type: Date },
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

// ✅ PRE-SAVE HOOK
purchaseInvoiceSchema.pre('save', async function (next) {
  try {
    let totalTaxable = 0;
    let gstTotal = 0;

    for (const item of this.items) {
      const itemDoc = await Item.findById(item.item);

      // ✅ Update latest HSN and GST snapshots
      if (itemDoc?.hsnCode) item.hsnSnapshot = itemDoc.hsnCode;
      if (itemDoc?.gstRate) item.gstSnapshot = itemDoc.gstRate;

      // ✅ Only use subQuantity for stock & value
      item.amount = (item.subQuantity || 0) * (item.rate || 0);
      totalTaxable += item.amount;

      // ✅ Use correct GST rate snapshot
      const gstRate = item.gstSnapshot || itemDoc?.gstRate || 0;
      gstTotal += (item.amount * gstRate) / 100;
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

// ✅ POST-SAVE HOOK — only subQuantity is counted in stock
purchaseInvoiceSchema.post('save', async function (doc, next) {
  try {
    await InventoryTransaction.deleteMany({ 'meta.invoice': doc._id });

    if (doc.items?.length) {
      const txns = doc.items.map((it) => ({
        item: it.item,
        type: 'PURCHASE',
        quantity: it.subQuantity || 0, // ✅ only subQuantity
        rate: it.rate || 0,
        amount: (it.subQuantity || 0) * (it.rate || 0),
        date: doc.date,
        meta: { invoice: doc._id },
      }));

      if (txns.length) {
        await InventoryTransaction.insertMany(txns);
        console.log(`✅ Created ${txns.length} PURCHASE transactions (subQuantity only)`);
      }
    }

    next();
  } catch (err) {
    console.error('❌ Error in post-save transaction creation:', err);
    next(err);
  }
});

module.exports = mongoose.model('PurchaseInvoice', purchaseInvoiceSchema);
