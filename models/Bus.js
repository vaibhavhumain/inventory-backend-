const mongoose = require("mongoose");

const busSchema = new mongoose.Schema(
  {
    busCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    ownerName: {
      type: String,
      trim: true,
    },

    chassisNo: {
      type: String,
      trim: true,
    },

    engineNo: {
      type: String,
      trim: true,
    },

    model: {
      type: String,
      enum: ["SP", "HY", "TO", "KA", "AR", "SE", "SL", "SS"],
      required: true,
    },

    issueBills: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "IssueBill" }],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Bus", busSchema);
