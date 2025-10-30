const mongoose = require("mongoose");
const Counter = require("./Counter");
const Category = require("./Category");

const itemSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true }, 
    headDescription: { type: String, required: true },
    subDescription: { type: String },
    unit: { type: String, default: "pcs" },
    hsnCode: { type: String },
    gstRate: { type: Number, default: 0 },
    remarks: { type: String },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
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

itemSchema.pre("validate", async function (next) {
  try {
    if (this.code) return next();
    if (!this.category) return next(new Error("Category is required for code generation"));

    const cat = await Category.findById(this.category).lean();
    if (!cat?.prefix) return next(new Error("Invalid category (prefix missing)"));

    const c = await Counter.findOneAndUpdate(
      { category: cat._id },                                   
      { $inc: { seq: 1 }, $setOnInsert: { category: cat._id } }, 
      { new: true, upsert: true }
    ).lean();

    this.code = `${cat.prefix}/${String(c.seq).padStart(4, "0")}`;
    next();
  } catch (err) {
    next(err);
  }
});


module.exports = mongoose.model("Item", itemSchema);
