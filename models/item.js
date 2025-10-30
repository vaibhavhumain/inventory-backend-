const mongoose = require("mongoose");
const Counter = require("./Counter");

const itemSchema = new mongoose.Schema({
  code: { type: String, unique: true },     // e.g. RM/0001
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
  dailyStock: [{
    date: { type: Date, default: Date.now },
    in: Number, out: Number,
    closingQty: Number, mainStoreQty: Number, subStoreQty: Number,
  }],
}, { timestamps: true });

itemSchema.pre("validate", async function(next) {
  if (this.code || !this.category) return next();
  const Category = mongoose.model("Category");
  const cat = await Category.findById(this.category).lean();
  if (!cat?.prefix) return next(new Error("Invalid category for code generation"));

  const doc = await Counter.findOneAndUpdate(
    { category: this.category },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  ).lean();

  this.code = `${cat.prefix}/${String(doc.seq).padStart(4, "0")}`;
  next();
});

module.exports = mongoose.model("Item", itemSchema);
