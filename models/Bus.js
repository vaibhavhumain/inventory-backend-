const mongoose = require("mongoose");

// Counter model to track bus code sequence
const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.model("Counter", counterSchema);

// Bus Schema
const busSchema = new mongoose.Schema(
  {
    busCode: { type: String, unique: true }, // e.g., GC/NB/0001
    chassisNumber: { type: String, required: true },
    engineNumber: { type: String, required: true },
    model: { type: String },
    remarks: { type: String },

    issueBills: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "IssueBill",
      },
    ],
  },
  { timestamps: true }
);

// Auto-generate incremental busCode
busSchema.pre("save", async function (next) {
  if (this.isNew && !this.busCode) {
    const counter = await Counter.findOneAndUpdate(
      { name: "busCode" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const seqNum = String(counter.seq).padStart(4, "0");
    this.busCode = `GC/NB/${seqNum}`; // e.g., GC/NB/0001
  }
  next();
});

module.exports = mongoose.model("Bus", busSchema);
