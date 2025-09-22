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
      enum: ['MAIN_TO_SUB', 'SUB_TO_USER'],
      required: true,
    },

    issuedTo: {
      type: String,
      validate: {
        validator: function (v) {
          if (this.type === 'SUB_TO_USER') {
            return v && v.trim().length > 0;
          }
          return true;
        },
        message: 'issuedTo is required when type is SUB_TO_USER',
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
      if (doc.type === 'SUB_TO_USER') txnType = 'CONSUMPTION'; // or SALE depending on your flow

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
