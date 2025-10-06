const mongoose = require("mongoose");

const busSchema = new mongoose.Schema(
  {
    busCode: {
      type: String,
      required: true, 
      unique: true,  
      trim: true,
    },
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
