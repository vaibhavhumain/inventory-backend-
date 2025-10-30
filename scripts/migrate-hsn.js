// scripts/migrateItemCategories.js
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const mongoose = require("mongoose");

// Adjust these requires if your filenames differ (case sensitive on some OS)
const Item = require("../models/item");          // ensure this points to your Item model file
const Category = require("../models/Category");

(async () => {
  const uri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.DATABASE_URL;

  if (!uri) {
    console.error("❌ Missing MONGO_URI (or MONGODB_URI / DATABASE_URL) in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      // If your connection string doesn’t include db name, optionally set:
      // dbName: process.env.MONGO_DB || "inventory",
    });
    console.log("✅ Connected to DB");

    // Load all categories and build lookup maps
    const cats = await Category.find({}).lean();
    console.log(cats.length, "categories");

    const byName = new Map();   // key: lower(name)
    const byLabel = new Map();  // key: lower(label)
    const byPrefix = new Map(); // key: upper(prefix)

    for (const c of cats) {
      if (c.name) byName.set(String(c.name).toLowerCase(), c._id);
      if (c.label) byLabel.set(String(c.label).toLowerCase(), c._id);
      if (c.prefix) byPrefix.set(String(c.prefix).toUpperCase(), c._id);
    }

    const resolveCategoryId = (val) => {
      if (!val) return null;
      // If already an ObjectId-like string, we’ll NOT trust it; this script expects strings of category names.
      const s = String(val);
      const lower = s.toLowerCase();
      const upper = s.toUpperCase();

      // Try name -> label -> prefix
      return (
        byName.get(lower) ||
        byLabel.get(lower) ||
        byPrefix.get(upper) ||
        null
      );
    };

    let scanned = 0;
    let updated = 0;
    let skipped = 0;
    let missing = 0;

    // Stream through items to avoid loading everything into memory
    const cursor = Item.find({}, { _id: 1, category: 1 }).cursor();

    for await (const it of cursor) {
      scanned++;

      // If already an ObjectId (or something non-string), skip
      if (typeof it.category !== "string") {
        skipped++;
        continue;
      }

      const id = resolveCategoryId(it.category);
      if (!id) {
        console.warn("⚠️  No Category found for:", it.category, "(item:", it._id.toString() + ")");
        missing++;
        continue;
      }

      await Item.updateOne({ _id: it._id }, { $set: { category: id } });
      updated++;
    }

    console.log("— Migration Summary —");
    console.log(` Scanned : ${scanned}`);
    console.log(` Updated : ${updated}`);
    console.log(` Skipped : ${skipped}  (already ObjectId or non-string)`);
    console.log(` Missing : ${missing}  (no matching Category)`);

  } catch (e) {
    console.error("❌ Migration error:", e);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected");
    process.exit();
  }
})();
