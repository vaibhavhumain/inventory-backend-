const mongoose = require('mongoose');
const InventoryTransaction = require('../models/InventoryTransaction');
const Item = require('../models/item');
function oid(id) {
  return new mongoose.Types.ObjectId(id);
}

// ✅ Single Item Summary (unchanged)
async function getItemSummary(itemId) {
  const rows = await InventoryTransaction.aggregate([
    { $match: { item: oid(itemId) } },
    { $group: { _id: "$type", qty: { $sum: "$quantity" }, amt: { $sum: "$amount" } } },
  ]);

  let purchase = 0, issue = 0, consumption = 0, sale = 0;
  let purchaseAmt = 0, issueAmt = 0, consumptionAmt = 0, saleAmt = 0;

  for (const r of rows) {
    if (r._id === "PURCHASE") { purchase = r.qty; purchaseAmt = r.amt; }
    if (r._id === "ISSUE_TO_SUB") { issue = r.qty; issueAmt = r.amt; }
    if (r._id === "CONSUMPTION") { consumption = r.qty; consumptionAmt = r.amt; }
    if (r._id === "SALE") { sale = r.qty; saleAmt = r.amt; }
  }

  const item = await Item.findById(itemId).populate("vendor");

  const balanceMainStore = purchase - issue;
  const balanceSubStore = issue - (consumption + sale);
  const balanceTotal = balanceMainStore + balanceSubStore;

  return {
    itemId: item?._id,
    itemCode: item?.code,
    description: item?.headDescription,
    unit: item?.unit,
    vendorId: item?.vendor?._id,
    vendorName: item?.vendor?.name || null,
    vendorCode: item?.vendor?.code || null,
    gstNumber: item?.vendor?.gstNumber || null,
    purchaseIn: purchase,
    purchaseAmt,
    issueToSub: issue,
    issueAmt,
    consumption,
    consumptionAmt,
    sale,
    saleAmt,
    balanceMainStore,
    balanceSubStore,
    balanceTotal,
  };
}

// ✅ Ensure stock check (unchanged)
async function ensureSufficientStock(itemId, type, qty) {
  const s = await getItemSummary(itemId);
  if (type === 'ISSUE_TO_SUB' && s.balanceMainStore < qty) {
    throw new Error('Insufficient stock in Main Store.');
  }
  if ((type === 'CONSUMPTION' || type === 'SALE') && s.balanceSubStore < qty) {
    throw new Error('Insufficient stock in Sub Store.');
  }
}

// ✅ All Items Daily Summary (with Item Code + Description)
async function getAllItemsSummary() {
  const rows = await InventoryTransaction.aggregate([
    {
      $group: {
        _id: {
          item: "$item",
          date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          type: "$type",
        },
        qty: { $sum: "$quantity" },
        amt: { $sum: "$amount" },
      },
    },
    {
      $group: {
        _id: { item: "$_id.item", date: "$_id.date" },
        purchaseQty: { $sum: { $cond: [{ $eq: ["$_id.type", "PURCHASE"] }, "$qty", 0] } },
        purchaseAmt: { $sum: { $cond: [{ $eq: ["$_id.type", "PURCHASE"] }, "$amt", 0] } },
        issueQty: { $sum: { $cond: [{ $eq: ["$_id.type", "ISSUE_TO_SUB"] }, "$qty", 0] } },
        issueAmt: { $sum: { $cond: [{ $eq: ["$_id.type", "ISSUE_TO_SUB"] }, "$amt", 0] } },
        consumptionQty: { $sum: { $cond: [{ $eq: ["$_id.type", "CONSUMPTION"] }, "$qty", 0] } },
        consumptionAmt: { $sum: { $cond: [{ $eq: ["$_id.type", "CONSUMPTION"] }, "$amt", 0] } },
        saleQty: { $sum: { $cond: [{ $eq: ["$_id.type", "SALE"] }, "$qty", 0] } },
        saleAmt: { $sum: { $cond: [{ $eq: ["$_id.type", "SALE"] }, "$amt", 0] } },
      },
    },
    {
      $lookup: {
        from: "items",
        localField: "_id.item",
        foreignField: "_id",
        as: "item",
      },
    },
    { $unwind: "$item" },
    {
      $project: {
        itemId: "$_id.item",
        date: "$_id.date",
        itemCode: "$item.code",
        description: "$item.headDescription",
        purchaseQty: 1,
        purchaseAmt: 1,
        issueQty: 1,
        issueAmt: 1,
        consumptionQty: 1,
        consumptionAmt: 1,
        saleQty: 1,
        saleAmt: 1,
      },
    },
    { $sort: { date: 1 } },
  ]);

  // ✅ Compute running balances day by day (per item separately)
  const groupedByItem = {};
  rows.forEach((r) => {
    if (!groupedByItem[r.itemId]) {
      groupedByItem[r.itemId] = { openingMain: 0, openingSub: 0, openingAmt: 0, records: [] };
    }
    const state = groupedByItem[r.itemId];

    const closingMain = state.openingMain + r.purchaseQty - r.issueQty;
    const closingSub = state.openingSub + r.issueQty - (r.consumptionQty + r.saleQty);
    const closingTotal = closingMain + closingSub;
    const closingAmt =
      state.openingAmt +
      r.purchaseAmt -
      (r.issueAmt + r.consumptionAmt + r.saleAmt);

    const rowWithCalc = {
      date: r.date,
      itemId: r.itemId,
      itemCode: r.itemCode,
      description: r.description,
      openingMain: state.openingMain,
      openingSub: state.openingSub,
      openingTotal: state.openingMain + state.openingSub,
      openingAmount: state.openingAmt,
      purchaseQty: r.purchaseQty,
      purchaseAmt: r.purchaseAmt,
      issueQty: r.issueQty,
      issueAmt: r.issueAmt,
      consumptionQty: r.consumptionQty,
      consumptionAmt: r.consumptionAmt,
      saleQty: r.saleQty,
      saleAmt: r.saleAmt,
      closingMain,
      closingSub,
      closingTotal,
      closingAmount: closingAmt,
    };

    state.records.push(rowWithCalc);

    // carry forward for next row of same item
    state.openingMain = closingMain;
    state.openingSub = closingSub;
    state.openingAmt = closingAmt;
  });

  // flatten into one array
  return Object.values(groupedByItem).flatMap((g) => g.records);
}

module.exports = {
  getItemSummary,
  ensureSufficientStock,
  getAllItemsSummary,
};
