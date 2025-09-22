const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },   
    name: { type: String, required: true },                
    category: { type: String },                            
    description: { type: String },
    unit: { type: String, default: "pcs" },
    hsnCode: { type: String },
    remarks: { type: String },

    closingQty: { type: Number, default: 0 },
    mainStoreQty: { type: Number, default: 0 },
    subStoreQty: { type: Number, default: 0 },

    dailyStock: [
      {
        date: { type: Date, default: Date.now },
        in: Number,
        out: Number,
        closingQty: Number,
        mainStoreQty: Number,
        subStoreQty: Number,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Item", itemSchema);
