const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  name:  { type: String, required: true, unique: true, trim: true, lowercase: true }, 
  label: { type: String, required: true, trim: true },   
  prefix:{ type: String, required: true, unique: true, uppercase: true, match: /^[A-Z]{2,4}$/, trim: true },
}, { timestamps: true });

module.exports = mongoose.model("Category", categorySchema);
