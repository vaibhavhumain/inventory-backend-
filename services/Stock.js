const mongoose = require('mongoose');
const InventoryTransaction = require('../models/InventoryTransaction');

function oid(id) {
  return new mongoose.Types.ObjectId(id);
}

async function getItemSummary(itemId) {
  const rows = await InventoryTransaction.aggregate([
    { $match: { item: oid(itemId) } },
    { $group: { _id: "$type", qty: { $sum: "$quantity" } } },
  ]);

  let purchase = 0, issue = 0, consumption = 0, sale = 0;
  for (const r of rows) {
    if (r._id === "PURCHASE") purchase = r.qty;
    if (r._id === "ISSUE_TO_SUB") issue = r.qty;
    if (r._id === "CONSUMPTION") consumption = r.qty;
    if (r._id === "SALE") sale = r.qty;
  }

  const item = await Item.findById(itemId).populate("vendor");

  const balanceMainStore = purchase - issue;
  const balanceSubStore = issue - (consumption + sale);
  const balanceTotal = balanceMainStore + balanceSubStore;

  return {
    itemId: item?._id,
    itemName: item?.name,
    unit: item?.unit,
    vendorId: item?.vendor?._id,
    vendorName: item?.vendor?.name || null,
    vendorCode: item?.vendor?.code || null,
    gstNumber: item?.vendor?.gstNumber || null,
    purchaseIn: purchase,
    issueToSub: issue,
    consumption,
    sale,
    balanceMainStore,
    balanceSubStore,
    balanceTotal,
  };
}

async function ensureSufficientStock(itemId, type, qty) {
  const s = await getItemSummary(itemId);
  if (type === 'ISSUE_TO_SUB' && s.balanceMainStore < qty) {
    throw new Error('Insufficient stock in Main Store.');
  }
  if ((type === 'CONSUMPTION' || type === 'SALE') && s.balanceSubStore < qty) {
    throw new Error('Insufficient stock in Sub Store.');
  }
}

async function getAllItemsSummary() {
  const rows = await InventoryTransaction.aggregate([
    {
      $group: {
        _id: { item: "$item", type: "$type" },
        qty: { $sum: "$quantity" },
      },
    },
    {
      $group: {
        _id: "$_id.item",
        purchaseIn: {
          $sum: { $cond: [{ $eq: ["$_id.type", "PURCHASE"] }, "$qty", 0] },
        },
        issueToSub: {
          $sum: { $cond: [{ $eq: ["$_id.type", "ISSUE_TO_SUB"] }, "$qty", 0] },
        },
        consumption: {
          $sum: { $cond: [{ $eq: ["$_id.type", "CONSUMPTION"] }, "$qty", 0] },
        },
        sale: {
          $sum: { $cond: [{ $eq: ["$_id.type", "SALE"] }, "$qty", 0] },
        },
      },
    },
    {
      $lookup: {
        from: "items",
        localField: "_id",
        foreignField: "_id",
        as: "item",
      },
    },
    { $unwind: "$item" },

    {
      $lookup: {
        from: "vendors",
        localField: "item.vendor",
        foreignField: "_id",
        as: "vendor",
      },
    },
    { $unwind: { path: "$vendor", preserveNullAndEmptyArrays: true } },

    {
      $project: {
        itemId: "$_id",
        itemName: "$item.name",
        unit: "$item.unit",
        purchaseIn: 1,
        issueToSub: 1,
        consumption: 1,
        sale: 1,
        balanceMainStore: { $subtract: ["$purchaseIn", "$issueToSub"] },
        balanceSubStore: {
          $subtract: ["$issueToSub", { $add: ["$consumption", "$sale"] }],
        },
        balanceTotal: {
          $add: [
            { $subtract: ["$purchaseIn", "$issueToSub"] },
            { $subtract: ["$issueToSub", { $add: ["$consumption", "$sale"] }] },
          ],
        },
        vendorId: "$vendor._id",
        vendorName: "$vendor.name",
        vendorCode: "$vendor.code",
        gstNumber: "$vendor.gstNumber",
      },
    },
    { $sort: { itemName: 1 } },
  ]);

  return rows;
}


module.exports = {
  getItemSummary,
  ensureSufficientStock,
  getAllItemsSummary,
};
