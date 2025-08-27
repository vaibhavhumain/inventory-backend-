const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const Item = require("../models/item");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/items", upload.single("file"), async (req, res) => {
  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

    const items = data.map((row) => ({
      code: row["Code"],
      closingQty: Number(row["ClosingQty"]) || 0,
      category: row["Category"].toLowerCase(),
      description: row["Description"],
      plantName: row["PlantName"],
      weight: row["Weight"] ? Number(row["Weight"]) : undefined,
      unit: row["Unit"],
      stockTaken: row["StockTaken"],
    }));

    await Item.insertMany(items);

    res.status(200).json({
      message: "✅ Items imported successfully",
      count: items.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
