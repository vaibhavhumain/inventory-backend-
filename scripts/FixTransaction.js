require("dotenv").config();
const mongoose = require("mongoose");
const InventoryTransaction = require("../models/InventoryTransaction");
const PurchaseInvoice = require("../models/purchaseInvoice");
const IssueBill = require("../models/issueBill");

async function fixTransactions() {
  await mongoose.connect(process.env.MONGO_URI);

  console.log("🔄 Fixing Purchase Transactions...");
  const purchases = await PurchaseInvoice.find().populate("items.item");
  for (const inv of purchases) {
    for (const it of inv.items) {
      await InventoryTransaction.updateMany(
        { "meta.invoice": inv._id, item: it.item._id, type: "PURCHASE" },
        {
          $set: {
            rate: it.rate || 0,
            amount: (it.subQuantity || 0) * (it.rate || 0),
          },
        }
      );
    }
  }

  console.log("🔄 Fixing Issue/Consumption/Sale Transactions...");
  const issues = await IssueBill.find();
  for (const bill of issues) {
    for (const it of bill.items) {
      let txnType = "ISSUE_TO_SUB";
      if (bill.type === "SUB_TO_USER") txnType = "CONSUMPTION";
      if (bill.type === "SUB_TO_SALE") txnType = "SALE";

      await InventoryTransaction.updateMany(
        { "meta.note": new RegExp(bill.department, "i"), item: it.item, type: txnType },
        {
          $set: {
            rate: it.rate || 0,
            amount: (it.quantity || 0) * (it.rate || 0),
          },
        }
      );
    }
  }

  console.log("✅ Backfill complete");
  process.exit(0);
}

fixTransactions().catch((err) => {
  console.error(err);
  process.exit(1);
});
