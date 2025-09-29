const mongoose = require("mongoose");
const Item = require("../models/item");
const Vendor = require("../models/vendor");
const InventoryTransaction = require("../models/InventoryTransaction");
const PurchaseInvoice = require("../models/purchaseInvoice");
const Bus = require("../models/Bus");
exports.createItem = async (req, res) => {
  try {
    const { category, headDescription, subDescription, unit, hsnCode, remarks, vendor } = req.body;

    if (!headDescription) {
      return res.status(400).json({ error: "headDescription is required" });
    }
    if (!category) {
      return res.status(400).json({ error: "category is required" });
    }
    const newItem = new Item({
      category,
      headDescription,
      subDescription,
      unit: unit || "pcs",
      hsnCode,
      remarks,
      vendor
    });

    await newItem.save();
    res.status(201).json(newItem);
  } catch (err) {
    console.error("Error creating item:", err);
    res.status(400).json({ error: err.message });
  }
};

exports.getItems = async (req, res) => {
  try {
    const items = await Item.find();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteItem = async (req, res) => {
  try {
    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getItemOverview = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Item details
    const item = await Item.findById(id).populate("vendor");
    if (!item) return res.status(404).json({ error: "Item not found" });

    // 2. Purchases grouped by vendor (summary)
    const purchaseAgg = await PurchaseInvoice.aggregate([
      { $unwind: "$items" },
      { $match: { "items.item": new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: "$vendor",
          totalPurchased: { $sum: "$items.subQuantity" },
          avgRate: { $avg: "$items.rate" },
          lastPurchaseDate: { $max: "$date" },
        },
      },
    ]);

    const vendors = await Vendor.find({
      _id: { $in: purchaseAgg.map((p) => p._id) },
    }).lean();

    // 3. Stock from transactions
    const txns = await InventoryTransaction.aggregate([
      { $match: { item: new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$quantity" },
        },
      },
    ]);

    let purchased = 0,
      consumed = 0;
    txns.forEach((t) => {
      if (t._id === "PURCHASE") purchased = t.total;
      if (t._id === "CONSUMPTION") consumed = t.total;
    });
    const currentStock = purchased - consumed;

    // 4. Bus consumption breakdown (summary)
    const busAgg = await InventoryTransaction.aggregate([
      {
        $match: {
          item: new mongoose.Types.ObjectId(id),
          type: "CONSUMPTION",
        },
      },
      {
        $group: {
          _id: "$meta.bus",
          totalConsumed: { $sum: "$quantity" },
        },
      },
    ]);

    const buses = await Bus.find({
      _id: { $in: busAgg.map((b) => b._id) },
    }).lean();

    const consumptionSummary = busAgg.map((bc) => {
      const busDoc = buses.find((b) => b._id.toString() === bc._id?.toString());
      return {
        bus: busDoc
          ? {
              _id: busDoc._id,
              busCode: busDoc.busCode,
              model: busDoc.model,
              chassisNumber: busDoc.chassisNumber,
              engineNumber: busDoc.engineNumber,
            }
          : null,
        totalConsumed: bc.totalConsumed,
      };
    });

    // 5. Full purchase history (detailed)
    const purchaseHistory = await PurchaseInvoice.find({
      "items.item": id,
    })
      .sort({ date: -1 })
      .populate("vendor", "name code")
      .populate("items.item", "code headDescription subDescription unit")
      .lean();

    // Pick latest invoice hsnCode if available
    let latestHsnCode = null;
    if (purchaseHistory.length > 0) {
      const latestInvoice = purchaseHistory[0];
      const line = latestInvoice.items.find(
        (it) => it.item._id.toString() === id
      );
      if (line?.hsnCode) {
        latestHsnCode = line.hsnCode;
      }
    }

    // Final Response
    res.json({
      item: {
        ...item.toObject?.() || item,
        hsnCode: latestHsnCode, // 🔑 override from latest invoice
      },
      vendors: purchaseAgg.map((pa) => ({
        vendor: vendors.find((v) => v._id.equals(pa._id)),
        totalPurchased: pa.totalPurchased,
        avgRate: pa.avgRate,
        lastPurchaseDate: pa.lastPurchaseDate,
      })),
      stock: {
        purchased,
        consumed,
        currentStock,
      },
      consumption: consumptionSummary,
      purchaseHistory,
    });
  } catch (err) {
    console.error("Error in getItemOverview:", err);
    res.status(500).json({ error: err.message });
  }
};


exports.getItemLedger = async (req, res) => {
  try {
    const { id } = req.params; // itemId
    const item = await Item.findById(id);
    if (!item) return res.status(404).json({ error: "Item not found" });

    // Fetch all transactions for this item
    const txns = await InventoryTransaction.find({ item: id })
      .sort({ date: 1 })
      .lean();

    if (!txns.length) return res.json({ item, ledger: [] });

    // Group transactions by day
    const byDay = {};
    txns.forEach(t => {
      const d = new Date(t.date).toISOString().split("T")[0];
      if (!byDay[d]) {
        byDay[d] = {
          purchase: { qty: 0, amt: 0 },
          issue: { qty: 0, amt: 0 },
          consumption: { qty: 0, amt: 0 },
          sale: { qty: 0, amt: 0 },
        };
      }
      if (t.type === "PURCHASE") {
        byDay[d].purchase.qty += t.quantity;
        byDay[d].purchase.amt += t.amount;
      }
      if (t.type === "ISSUE_TO_SUB") {
        byDay[d].issue.qty += t.quantity;
        byDay[d].issue.amt += t.amount;
      }
      if (t.type === "CONSUMPTION") {
        byDay[d].consumption.qty += t.quantity;
        byDay[d].consumption.amt += t.amount;
      }
      if (t.type === "SALE") {
        byDay[d].sale.qty += t.quantity;
        byDay[d].sale.amt += t.amount;
      }
    });

    // Walk through days chronologically
    const dates = Object.keys(byDay).sort();
    let openingMain = 0, openingSub = 0, openingAmt = 0;
    const ledger = [];

    for (const d of dates) {
      const row = byDay[d];

      // Opening
      const openingTotal = openingMain + openingSub;

      // Movements
      const { qty: purchaseQty, amt: purchaseAmt } = row.purchase;
      const { qty: issueQty, amt: issueAmt } = row.issue;
      const { qty: consumptionQty, amt: consumptionAmt } = row.consumption;
      const { qty: saleQty, amt: saleAmt } = row.sale;

      // Closing balances
      const closingMain = openingMain + purchaseQty - issueQty;
      const closingSub = openingSub + issueQty - (consumptionQty + saleQty);
      const closingTotal = closingMain + closingSub;

      const closingAmt =
        openingAmt + purchaseAmt - issueAmt - consumptionAmt - saleAmt;

      ledger.push({
        date: d,
        openingMain,
        openingSub,
        openingTotal,
        openingAmount: openingAmt,
        purchaseQty,
        purchaseAmt,
        issueQty,
        issueAmt,
        consumptionQty,
        consumptionAmt,
        saleQty,
        saleAmt,
        closingMain,
        closingSub,
        closingTotal,
        closingAmount: closingAmt,
      });

      // Carry forward
      openingMain = closingMain;
      openingSub = closingSub;
      openingAmt = closingAmt;
    }

    res.json({ item, ledger });
  } catch (err) {
    console.error("Error in getItemLedger:", err);
    res.status(500).json({ error: err.message });
  }
};
