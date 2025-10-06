const mongoose = require("mongoose");

const logSchema = new mongoose.Schema({
  source: { type: String, enum: ["frontend", "backend"], required: true },
  level: { type: String, enum: ["info", "warn", "error"], default: "info" },
  message: { type: String, required: true },
  user: { type: String }, 
  meta: { type: Object },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Log", logSchema);
