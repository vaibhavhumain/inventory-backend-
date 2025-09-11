// controllers/analysisController.js
const Item = require('../models/item');
const PurchaseBill = require('../models/purchaseBill');
const IssueBill = require('../models/issueBill');

exports.getStockValue = async (req, res) => {
  try {
    const items = await Item.find();
    let totalValue = 0;

    for (const item of items) {
      // Get last purchase rate
      const purchase = await PurchaseBill.findOne(
        { "items.item": item._id },
        { "items.$": 1 }
      ).sort({ billDate: -1 });

      const rate = purchase?.items[0]?.rate || 0;
      totalValue += (item.closingQty || 0) * rate;
    }

    res.json({ totalStockValue: totalValue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getConsumptionRate = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const issues = await IssueBill.aggregate([
      { $match: { issueDate: { $gte: new Date(startDate), $lte: new Date(endDate) } } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "items",
          localField: "items.item",
          foreignField: "_id",
          as: "itemDetails"
        }
      },
      { $unwind: "$itemDetails" },
      {
        $group: {
          _id: "$items.item",
          description: { $first: "$itemDetails.description" },
          code: { $first: "$itemDetails.code" },
          totalIssued: { $sum: "$items.quantity" }
        }
      }
    ]);

    res.json({ consumption: issues });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getReorderPoints = async (req, res) => {
  try {
    const items = await Item.find();
    const result = [];

    for (const item of items) {
      // Calculate avg daily usage from last 30 days
      const last30 = item.dailyStock.filter(d => {
        return (new Date() - new Date(d.date)) / (1000*60*60*24) <= 30;
      });

      const avgDaily = last30.reduce((a,b) => a + b.out, 0) / (last30.length || 1);
      const leadTime = 7; // assume 7 days
      const safetyStock = avgDaily * 2;

      const reorderPoint = (avgDaily * leadTime) + safetyStock;

      result.push({
        itemCode: item.code,
        description: item.description,
        currentQty: item.closingQty,
        reorderPoint,
        needsReorder: item.closingQty < reorderPoint
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTurnoverRatios = async (req, res) => {
  try {
    const items = await Item.find();
    const result = [];

    for (const item of items) {
      const totalIssued = item.dailyStock.reduce((a,b) => a + b.out, 0);
      const avgStock = item.dailyStock.reduce((a,b) => a + b.closingQty, 0) / (item.dailyStock.length || 1);
      const turnoverRatio = avgStock > 0 ? totalIssued / avgStock : 0;

      result.push({
        itemCode: item.code,
        description: item.description,
        turnoverRatio,
        type: turnoverRatio > 2 ? "Fast-moving" : "Slow-moving"
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// controllers/analysisController.js
exports.getConsumptionTrend = async (req, res) => {
  try {
    const issues = await IssueBill.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: {
            year: { $year: "$issueDate" },
            month: { $month: "$issueDate" },
          },
          totalIssued: { $sum: "$items.quantity" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const formatted = issues.map(i => ({
      year: i._id.year,
      month: i._id.month,
      totalIssued: i.totalIssued,
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
