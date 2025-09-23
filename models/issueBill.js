const mongoose = require('mongoose');
const InventoryTransaction = require('./InventoryTransaction');

const billItemSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    quantity: { type: Number, required: true },
    rate: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const issueBillSchema = new mongoose.Schema(
  {
    issueDate: { type: Date, default: Date.now },
    department: { type: String, required: true },

    type: {
      type: String,
      enum: ['MAIN_TO_SUB', 'SUB_TO_USER', 'SUB_TO_SALE'], // ✅ Added SUB_TO_SALE
      required: true,
    },

    issuedTo: {
      type: String,
      validate: {
        validator: function (v) {
          if (['SUB_TO_USER', 'SUB_TO_SALE'].includes(this.type)) {
            return v && v.trim().length > 0;
          }
          return true;
        },
        message: 'issuedTo is required when type is SUB_TO_USER or SUB_TO_SALE',
      },
    },

    items: [billItemSchema],
    totalAmount: { type: Number, default: 0 },
    issuedBy: { type: String },
  },
  { timestamps: true }
);

/**
 * 🔹 Pre-save hook to auto-calc amounts
 */
issueBillSchema.pre('save', function (next) {
  this.items.forEach((it) => {
    it.amount = it.quantity * (it.rate || 0);
  });
  this.totalAmount = this.items.reduce((sum, it) => sum + it.amount, 0);
  next();
});

/**
 * 🔹 Post-save hook to log Inventory Transactions
 */
issueBillSchema.post('save', async function (doc, next) {
  try {
    for (const it of doc.items) {
      let txnType;
      if (doc.type === 'MAIN_TO_SUB') txnType = 'ISSUE_TO_SUB';
      if (doc.type === 'SUB_TO_USER') txnType = 'CONSUMPTION';
      if (doc.type === 'SUB_TO_SALE') txnType = 'SALE'; // ✅ new case

      if (txnType) {
        await InventoryTransaction.create({
          item: it.item,
          type: txnType,
          quantity: it.quantity,
          date: doc.issueDate,
        });
      }
    }
    next();
  } catch (err) {
    console.error('Error logging inventory transaction:', err);
    next(err);
  }
});

module.exports = mongoose.model('IssueBill', issueBillSchema);
