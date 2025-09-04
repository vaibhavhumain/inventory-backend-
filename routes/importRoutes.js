const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs");
const { bulkUpdateItems } = require("../controllers/itemController");

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

router.post("/", upload.single("file"), async (req, res, next) => {
  try {
    console.log("File uploaded:", req.file);

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

    console.log("Parsed rows:", data.length);

    const today = new Date();
    const changes = [];

    for (let idx = 0; idx < data.length; idx++) {
      const row = data[idx];
      const qty = Number(row["Closing Quantity"] || row["Closing Q"]) || 0;

      let code = row["Code"]?.toString().trim();
      if (!code) code = (idx + 1).toString();

      const mainStoreQty = Number(row["Main Store"]) || 0;
      const subStoreQty = Number(row["Sub Store"]) || 0;

      changes.push({
        code,
        newQty: qty,
        mainStoreQty,
        subStoreQty,
      });
    }

    if (req.file?.path) fs.unlinkSync(req.file.path);

    req.body = { date: today, changes };
    return bulkUpdateItems(req, res, next);
  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
