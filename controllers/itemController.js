const mongoose = require("mongoose");
const Item = require("../models/item");
const Vendor = require("../models/vendor");
const InventoryTransaction = require("../models/InventoryTransaction");
const PurchaseInvoice = require("../models/PurchaseInvoice");
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

    // 2. Purchases grouped by vendor
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
    });

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

    // 4. Bus consumption breakdown
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
    });

    res.json({
      item,
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
      consumption: busAgg.map((bc) => ({
        bus: buses.find((b) => b._id.equals(bc._id)),
        totalConsumed: bc.totalConsumed,
      })),
    });
  } catch (err) {
    console.error("Error in getItemOverview:", err);
    res.status(500).json({ error: err.message });
  }
};