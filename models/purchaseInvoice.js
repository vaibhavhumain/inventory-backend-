const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  item: { type: String, required: true },
  description: { type: String },
  headQuantity: { type: Number, required: true },
  headQuantityMeasurement: { type: String, required: true },
  subQuantity: { type: Number, required: true },
  subQuantityMeasurement: { type: String },
  hsnCode: { type: String },
  rate: { type: Number, required: true },
  amount: { type: Number },
  gstRate: { type: Number },
  notes: { type: String }
}, { _id: false });

const purchaseInvoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  date: { type: Date, default: Date.now },

  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  partyName: { type: String, required: true },

  items: [invoiceItemSchema],

  // ✅ before-tax charges
  otherChargesBeforeTaxAmount: { type: Number, default: 0 },
  otherChargesBeforeTaxPercent: { type: Number, default: 0 },
  otherChargesBeforeTaxGstRate: { type: Number, default: 0 },  // ✅ added

  // ✅ after-tax charges
  otherChargesAfterTax: { type: Number, default: 0 },

  // ✅ totals
  totalTaxableValue: { type: Number },
  totalInvoiceValue: { type: Number }
}, { timestamps: true });

purchaseInvoiceSchema.pre('save', function (next) {
  let totalTaxable = 0;
  let gstTotal = 0;

  // calculate item-wise taxable and GST
  this.items.forEach(item => {
    item.amount = (item.subQuantity || 0) * (item.rate || 0);
    totalTaxable += item.amount;

    if (item.gstRate) {
      gstTotal += (item.amount * item.gstRate) / 100;
    }
  });

  // calculate other charges (before tax)
  const beforeTaxPercentValue =
    (totalTaxable * (this.otherChargesBeforeTaxPercent || 0)) / 100;
  const beforeTaxFixedValue = this.otherChargesBeforeTaxAmount || 0;
  const beforeTaxTotal = beforeTaxFixedValue + beforeTaxPercentValue;

  // ✅ GST on before-tax charges
  const beforeTaxGst =
    (beforeTaxTotal * (this.otherChargesBeforeTaxGstRate || 0)) / 100;

  // ✅ store totals
  this.totalTaxableValue = totalTaxable + beforeTaxTotal;
  this.totalInvoiceValue =
    totalTaxable + beforeTaxTotal + gstTotal + beforeTaxGst + (this.otherChargesAfterTax || 0);

  next();
});

module.exports = mongoose.model('PurchaseInvoice', purchaseInvoiceSchema);
