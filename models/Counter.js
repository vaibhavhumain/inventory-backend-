const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", unique: true },
  seq: { type: Number, default: 0 },
});
module.exports = mongoose.model("Counter", counterSchema);
