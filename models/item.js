const mongoose = require("mongoose");
const Counter = require("./Counter");
const Category = require("./Category");

const itemSchema = new mongoose.Schema({
  code: { type: String, unique: true },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },
  headDescription: { type: String, required: true },
  subDescription: String,
  hsnCode: String,
  gstRate: { type: Number, default: 0 },
  remarks: String,
  unit: { type: String, default: "pcs" },
}, { timestamps: true });

async function generateUniqueCode(categoryId) {
  const cat = await Category.findById(categoryId).lean();
  if (!cat?.prefix) throw new Error("Invalid category or missing prefix");

  const prefix = cat.prefix;
  let code = "";
  let attempts = 0;

  while (attempts < 10) {
    const counter = await Counter.findOneAndUpdate(
      { name: prefix },
      { $inc: { seq: 1 }, $setOnInsert: { name: prefix } },
      { new: true, upsert: true }
    );

    code = `${prefix}/${String(counter.seq).padStart(4, "0")}`;

    const exists = await mongoose.models.Item.exists({ code });
    if (!exists) return code;

    console.warn(`Duplicate ${code} detected — retrying...`);
    attempts++;
  }

  throw new Error(`Failed to generate unique code for prefix ${prefix}`);
}

itemSchema.pre("save", async function (next) {
  try {
    if (this.code) return next();
    this.code = await generateUniqueCode(this.category);
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Item", itemSchema);
