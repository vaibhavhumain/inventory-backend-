const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.model("Counter", counterSchema);

const busSchema = new mongoose.Schema(
  {
    busCode: { type: String, unique: true },
    chassisNumber: { type: String, required: true },
    engineNumber: { type: String, required: true },
    model: { type: String },
    remarks: { type: String },

    issueBill: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "IssueBill",
      required: true,
    },
  },
  { timestamps: true }
);

// Auto-generate busCode
busSchema.pre("save", async function (next) {
  if (this.isNew) {
    const counter = await Counter.findOneAndUpdate(
      { name: "busCode" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const seqNum = String(counter.seq).padStart(4, "0");
    this.busCode = `GC/NB/${seqNum}`;
  }
  next();
});

module.exports = mongoose.model("Bus", busSchema);
