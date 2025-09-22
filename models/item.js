const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    sku: { type: String },
    unit: { type: String, default: 'pcs' },
    hsnCode: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Item', itemSchema);
