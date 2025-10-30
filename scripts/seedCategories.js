const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const mongoose = require("mongoose");
const Category = require("../models/Category");

const initial = {
  "raw material": "RM",
  consumables: "CON",
  "bought out": "BOP",
  hardware: "HW",
  electronics: "ES",
  electricals: "EL",
  paints: "PT",
  rubbers: "RB",
  chemicals: "CH",
  adhesive: "AD",
  plastics: "PL",
  furniture: "FR",
};

(async () => {
  const uri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.DATABASE_URL;

  if (!uri) {
    console.error(
      "❌ Missing MONGO_URI (or MONGODB_URI / DATABASE_URL) in .env. " +
      "Make sure it's defined in your project root .env."
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      // If you use a shared cluster, you can set dbName via env:
      // dbName: process.env.MONGO_DB, 
    });
    console.log("✅ Connected to DB");

    for (const [name, prefix] of Object.entries(initial)) {
      const label = name.replace(/\b\w/g, (c) => c.toUpperCase());
      await Category.updateOne(
        { name }, // canonical key (lowercase if you store as lowercase)
        { $setOnInsert: { name, label, prefix } },
        { upsert: true }
      );
    }

    console.log("✅ Categories seeded");
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
})();
