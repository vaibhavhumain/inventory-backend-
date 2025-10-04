const mongoose = require("mongoose");
const IssueBill = require("../models/issueBill");
const Bus = require("../models/Bus");

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://vaibhav:gobindcoach@cluster0.e6f65rz.mongodb.net/inventory?retryWrites=true&w=majority&appName=Cluster0";

async function migrate() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB");

  const issueBills = await IssueBill.find({ bus: { $exists: true, $ne: null } });

  console.log(`Found ${issueBills.length} issueBills with bus field`);

  let migratedCount = 0;

  for (const ib of issueBills) {
    try {
      const busId = ib.bus;

      // Push into Bus.issueBills array
      await Bus.findByIdAndUpdate(
        busId,
        { $addToSet: { issueBills: ib._id } }, // prevent duplicates
        { new: true }
      );

      migratedCount++;
      console.log(`✅ Linked IssueBill ${ib._id} → Bus ${busId}`);
    } catch (err) {
      console.error(`⚠️ Error migrating IssueBill ${ib._id}:`, err.message);
    }
  }

  console.log(`\n✅ Migration complete. ${migratedCount} IssueBills linked to Buses.`);
  mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  mongoose.disconnect();
});
