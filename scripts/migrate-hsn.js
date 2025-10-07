require("dotenv").config();
const mongoose = require("mongoose");
const Item = require("../models/item"); 

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const items = await Item.find({
      $or: [{ gstRate: { $exists: false } }, { gstRate: { $eq: null } }],
    });

    console.log(`Found ${items.length} items without gstRate`);

    let updatedCount = 0;

    for (const item of items) {
      let defaultGst = 18;

      if (item.category === "raw material") defaultGst = 5;
      if (item.category === "consumables") defaultGst = 12;
      if (item.category === "chemicals") defaultGst = 18;
      if (item.category === "furniture") defaultGst = 28;

      item.gstRate = defaultGst;
      await item.save();
      updatedCount++;
    }

    console.log(`✅ Updated ${updatedCount} items successfully`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error updating items:", err);
    process.exit(1);
  }
})();
