const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const Item = require("../models/item");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// --- Category Normalizer ---
function normalizeCategory(cat) {
  if (!cat) return null;
  cat = cat.toLowerCase().trim();

  const mapping = {
    "raw material": "raw material",
    "raw materials": "raw material",

    "consumables": "consumables",
    "consumeables": "consumables",   // typo fix

    "bought out": "bought out",
    "bought out ": "bought out",     // extra space fix

    "hardware": "hardware",
    "electronics": "electronics",
    "electricals": "electricals",

    "paints": "paints",
    "rubbers": "rubbers",
    "chemicals": "chemicals",

    "adhessive": "adhesive",         // typo fix
    "adhesive": "adhesive",

    "plastics": "plastics"
  };

  return mapping[cat] || cat;  // return cleaned category or leave as-is
}

// --- Excel Import Route ---
router.post("/items", upload.single("file"), async (req, res) => {
  try {
    // Read uploaded Excel
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

    // Map Excel rows to DB schema
    const items = data.map((row) => ({
      code: row["Code"],
      closingQty: Number(row["Closing Quantity"]) || 0,
      category: normalizeCategory(row["CATEGORY"]),
      description: row["ITEM DESCRIPTION"] || "",
      plantName: row["PLANT NAME"] || "",
      weight: row["WEIGHT per sheet / pipe"] ? Number(row["WEIGHT per sheet / pipe"]) : undefined,
      unit: row["UOM"] || "",
      stockTaken: row["stock taken qty"] || "",
      location: row["Location"] || "",
    }));

    // Insert into DB
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
