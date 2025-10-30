// models/Counter.js
const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema(
  {
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", unique: true, index: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);

counterSchema.index({ category: 1 }, { unique: true }); // ensure index

module.exports = mongoose.model("Counter", counterSchema);
