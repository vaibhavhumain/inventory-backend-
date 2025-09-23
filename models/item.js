const mongoose = require("mongoose");

const categoryPrefixes = {
  "raw material": "RM",
  "consumables": "CON",
  "bought out": "BOP",
  "hardware": "HW",
  "electronics": "ES",
  "electricals": "EL",
  "paints": "PT",
  "rubbers": "RB",
  "chemicals": "CH",
  "adhesive": "AD",
  "plastics": "PL",
  "furniture": "FR"
};

const itemSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true },  
    name: { type: String, required: true },
    category: { 
      type: String, 
      enum: Object.keys(categoryPrefixes),
      required: true
    },
    headDescription: { type: String },
    subDescription: { type: String },
    unit: { type: String, default: "pcs" },
    hsnCode: { type: String },
    remarks: { type: String },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },
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

itemSchema.pre("save", async function(next) {
  if (!this.code && this.category) {
    const prefix = categoryPrefixes[this.category];
    if (!prefix) return next(new Error("Invalid category for code generation"));

    const lastItem = await mongoose.model("Item")
      .findOne({ category: this.category })
      .sort({ createdAt: -1 });

    let nextNumber = 1;
    if (lastItem?.code) {
      const parts = lastItem.code.split("/");
      const lastNumber = parseInt(parts[1], 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    this.code = `${prefix}/${String(nextNumber).padStart(4, "0")}`;
  }
  next();
});

module.exports = mongoose.model("Item", itemSchema);
