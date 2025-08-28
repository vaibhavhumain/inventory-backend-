const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const Item = require("../models/item");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

function normalizeCategory(cat) {
  if (!cat) return null;
  cat = cat.toLowerCase().trim();

  const mapping = {
    "raw material": "raw material",
    "raw materials": "raw material",
    "consumables": "consumables",
    "consumeables": "consumables",
    "bought out": "bought out",
    "hardware": "hardware",
    "electronics": "electronics",
    "electricals": "electricals",
    "paints": "paints",
    "rubbers": "rubbers",
    "chemicals": "chemicals",
    "adhessive": "adhesive", 
    "adhesive": "adhesive",
    "plastics": "plastics"
  };

  return mapping[cat] || cat;
}

let autoCounter = 1;

router.post("/items", upload.single("file"), async (req, res) => {
  try {
    console.log("File uploaded:", req.file);

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

    console.log("Parsed rows:", data.length);

    const items = data.map((row, idx) => {
  return {
    code: row["Code"]?.toString().trim() || `AUTO${idx + 1}`,
    closingQty: Number(row["Closing Quantity"]) || 0,
    category: normalizeCategory(row["CATEGORY"]) || "",
    description: (row["ITEM DESCRIPTION"] || "").trim(),
    plantName: (row["PLANT NAME"] || "").trim(),
    weight: row["WEIGHT per sheet / pipe"]
      ? Number(row["WEIGHT per sheet / pipe"])
      : undefined,
    unit: (row["UOM"] || "").trim(),
    stockTaken: (row["stock taken qty"] || "").trim(),
    location: (row["Location"] || "").trim(),
    storeLocation: (
  row["Store Location"] ||
  row["Store Loc"] || 
  row["STORE LOCATION"] || 
  ""
).toString().trim() || null,

remarks: (
  row["Remarks"] ||
  row["Remark"] ||
  row["REMARKS"] ||
  ""
).toString().trim() || null,
  };
});

    console.log("Prepared items:", items.length);

    const batchSize = 200;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await Item.insertMany(batch, { ordered: false });
      console.log(`Inserted batch ${i / batchSize + 1}`);
    }

    res.status(200).json({
      message: "✅ Items imported successfully",
      count: items.length,
    });
  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;
