// models/vendor.js
const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  address: { type: String },
  state: { type: String },
  gstNumber: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Vendor', vendorSchema);
