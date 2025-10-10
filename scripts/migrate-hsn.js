const mongoose = require("mongoose");
require("dotenv").config();
const PurchaseInvoice = require("../models/purchaseInvoice");
const InventoryTransaction = require("../models/InventoryTransaction");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to DB");

    const invoices = await PurchaseInvoice.find().populate("items.item");
    let fixed = 0;

    for (const inv of invoices) {
      // Remove old txns
      await InventoryTransaction.deleteMany({ "meta.invoice": inv._id });

      // Re-create transactions using only subQuantity
      const txns = inv.items.map((it) => ({
        item: it.item._id,
        type: "PURCHASE",
        quantity: it.subQuantity || 0,        // ✅ only sub qty
        rate: it.rate || 0,
        amount: (it.subQuantity || 0) * (it.rate || 0),
        date: inv.date,
        meta: { invoice: inv._id },
      }));

      if (txns.length) {
        await InventoryTransaction.insertMany(txns);
        fixed++;
      }
    }

    console.log(`🎯 Rebuilt ${fixed} purchase invoices.`);
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
