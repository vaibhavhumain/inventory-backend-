const mongoose = require("mongoose");

const busSchema = new mongoose.Schema(
  {
    busCode: {
      type: String,
      required: true, 
      unique: true,  
      trim: true,
    },
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

module.exports = mongoose.model("Bus", busSchema);
