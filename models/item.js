const mongoose = require('mongoose');

const dailyStockSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  in: { type: Number, default: 0 },
  out: { type: Number, default: 0 },
  closingQty: { type: Number, default: 0 },
  mainStoreQty: { type: Number, default: 0 },
  subStoreQty: { type: Number, default: 0 }
}, { _id: false });

const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true },   
  amount: { type: Number, required: true }, 
}, { _id: false });

const supplierHistorySchema = new mongoose.Schema({
  supplierName: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },   
}, { _id: false });

const itemSchema = new mongoose.Schema({
  code: { type: String, unique: true },
  category: { type: String },
  description: { type: String },
  plantName: { type: String },
  weight: { type: Number },
  unit: { type: String },
  closingQty: { type: Number, default: 0 },
  stockTaken: { type: String },
  dailyStock: [dailyStockSchema],
  location: { type: String },
  mainStoreQty: { type: Number, default: 0 },
  subStoreQty: { type: Number, default: 0 },
  remarks: { type: String, default: null },

  suppliers: [supplierSchema],

  supplierHistory: [supplierHistorySchema],

  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Item', itemSchema);
