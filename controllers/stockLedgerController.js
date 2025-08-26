const StockLedger = require("../models/stockLedger");

exports.feedStock = async (req, res) => {
  try {
    const { itemName, quantity } = req.body;

    if (!itemName || !quantity) {
      return res.status(400).json({ error: "Item name and quantity are required" });
    }

    const stock = new StockLedger({
      itemName,
      quantity,
      type: "IN"
    });

    await stock.save();
    res.status(201).json({ message: "Stock added successfully", stock });
  } catch (error) {
    console.error("Error feeding stock:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.issueStock = async (req, res) => {
  try {
    const { itemName, quantity } = req.body;

    if (!itemName || !quantity) {
      return res.status(400).json({ error: "Item name and quantity are required" });
    }

    const stock = new StockLedger({
      itemName,
      quantity,
      type: "OUT"
    });

    await stock.save();
    res.status(201).json({ message: "Stock issued successfully", stock });
  } catch (error) {
    console.error("Error issuing stock:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getStocks = async (req, res) => {
  try {
    const stocks = await StockLedger.find().sort({ date: -1 });
    res.status(200).json(stocks);
  } catch (error) {
    console.error("Error fetching stocks:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getStockByItem = async (req, res) => {
  try {
    const { itemName } = req.params;
    const stocks = await StockLedger.find({ itemName });
    if (!stocks || stocks.length === 0) {
      return res.status(404).json({ error: "No stock found for this item" });
    }
    res.status(200).json(stocks);
  } catch (error) {
    console.error("Error fetching stock by item:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getStockByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const queryDate = new Date(date);

    if (isNaN(queryDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    const stocks = await StockLedger.find({
      date: {
        $gte: new Date(queryDate.setHours(0, 0, 0, 0)),
        $lte: new Date(queryDate.setHours(23, 59, 59, 999))
      }
    });

    if (!stocks || stocks.length === 0) {
      return res.status(404).json({ error: "No stock found for this date" });
    }

    res.status(200).json(stocks);
  } catch (error) {
    console.error("Error fetching stock by date:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.deleteStock = async (req, res) => {
  try {
    const deleted = await StockLedger.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Stock record not found" });
    }
    res.status(200).json({ message: "Stock record deleted" });
  } catch (error) {
    console.error("Error deleting stock:", error);
    res.status(500).json({ error: "Server error" });
  }
};
