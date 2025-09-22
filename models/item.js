const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true }, 
    sku: String,
    unit: { type: String, default: 'pcs' }, 
    hsnCode: String,
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Item', itemSchema);
