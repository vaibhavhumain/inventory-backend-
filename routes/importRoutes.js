const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const Item = require("../models/item");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Normalize categories
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
    "adhessive": "adhesive", // fix typo
    "adhesive": "adhesive",
    "plastics": "plastics"
  };

  return mapping[cat] || cat;
}

// Auto code counter for missing codes
let autoCounter = 1;

router.post("/items", upload.single("file"), async (req, res) => {
  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

    const items = data
      .map((row) => {
        const code = row["Code"]?.toString().trim();
        const category = normalizeCategory(row["CATEGORY"]);

        // Skip junk header rows
        if (!code && !row["ITEM DESCRIPTION"]) {
          return null;
        }

        return {
          code: code || `AUTO${autoCounter++}`,   // fallback auto-code
          closingQty: Number(row["Closing Quantity"]) || 0,
          category: category || "raw material",  // fallback category
          description: (row["ITEM DESCRIPTION"] || "").trim(),
          plantName: (row["PLANT NAME"] || "").trim(),
          weight: row["WEIGHT per sheet / pipe"]
            ? Number(row["WEIGHT per sheet / pipe"])
            : undefined,
          unit: (row["UOM"] || "").trim(),
          stockTaken: (row["stock taken qty"] || "").trim(),
          location: (row["Location"] || "").trim(),
        };
      })
      .filter(Boolean); // remove skipped rows

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
