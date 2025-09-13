const mongoose = require('mongoose');

const billItemSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  quantity: { type: Number, required: true },
  rate: { type: Number, default: 0 },
  amount: { type: Number, default: 0 }
}, { _id: false });

const issueBillSchema = new mongoose.Schema({
  issueDate: { type: Date, default: Date.now },
  department: { type: String, required: true },

  type: { 
    type: String, 
    enum: ['MAIN_TO_SUB', 'SUB_TO_USER'], 
    required: true 
  },

  issuedTo: { type: String },

  items: [billItemSchema],
  totalAmount: { type: Number, default: 0 },
  issuedBy: { type: String },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('IssueBill', issueBillSchema);
