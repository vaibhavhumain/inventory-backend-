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
  closingQty: Number(row["Closing Quantity"]) || 0,
  category: row["CATEGORY"] ? row["CATEGORY"].toLowerCase() : "",
  description: row["ITEM DESCRIPTION"],
  plantName: row["PLANT NAME"],
  weight: row["WEIGHT per sheet / pipe"] ? Number(row["WEIGHT per sheet / pipe"]) : undefined,
  unit: row["UOM"],
  stockTaken: row["stock taken qty"],
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
