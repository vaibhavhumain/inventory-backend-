const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs/promises");
const Item = require("../models/item");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// OPTIONAL but recommended in your Item schema:
// ItemSchema.index({ code: 1 }, { unique: true });

const val = (v) => (v === null || v === undefined ? undefined : String(v).trim());
const num = (v) => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const normalizeCategory = (cat) => {
  if (!cat) return undefined;
  cat = String(cat).toLowerCase().trim();
  const map = {
    "raw material": "raw material",
    "raw materials": "raw material",
    consumables: "consumables",
    consumeables: "consumables",
    "bought out": "bought out",
    hardware: "hardware",
    electronics: "electronics",
    electricals: "electricals",
    paints: "paints",
    rubbers: "rubbers",
    chemicals: "chemicals",
    adhessive: "adhesive",
    adhesive: "adhesive",
    plastics: "plastics",
  };
  return map[cat] || cat;
};

// Build a document strictly from what the row provides.
// Only set a field if the cell exists; otherwise leave it out.
function makeDocFromRow(row) {
  const doc = {};
  // Primary key to identify rows
  const code = val(row["Code"]);
  if (code) doc.code = code; // if your schema requires code, this must exist

  // Map only known columns; don’t invent defaults
  const closingQty = num(row["Closing Quantity"] ?? row["Closing Q"]);
  if (closingQty !== undefined) doc.closingQty = closingQty;

  const category = normalizeCategory(row["CATEGORY"]);
  if (category !== undefined) doc.category = category;

  const description = val(row["ITEM DESCRIPTION"]);
  if (description !== undefined) doc.description = description;

  const plantName = val(row["PLANT NAME"]);
  if (plantName !== undefined) doc.plantName = plantName;

  const weightSrc = row["WEIGHT"] ?? row["WEIGHT per sheet / pipe"];
  const weight = num(weightSrc);
  if (weight !== undefined) doc.weight = weight;

  const unit = val(row["UC"] ?? row["UOM"]);
  if (unit !== undefined) doc.unit = unit;

  const stockTaken = val(row["stock taken qt"] ?? row["stock taken qty"]);
  if (stockTaken !== undefined) doc.stockTaken = stockTaken;

  const location = val(row["Location"]);
  if (location !== undefined) doc.location = location;

  const remarks = val(row["Remarks"] ?? row["REMARKS"] ?? row["remark"] ?? row["REMARK"]);
  if (remarks !== undefined) doc.remarks = remarks;

  const mainStoreQty = num(row["Main Store"]);
  if (mainStoreQty !== undefined) doc.mainStoreQty = mainStoreQty;

  const subStoreQty = num(row["Sub Store"]);
  if (subStoreQty !== undefined) doc.subStoreQty = subStoreQty;

  return doc;
}

let importLock = false;

router.post("/", upload.single("file"), async (req, res) => {
  if (importLock) return res.status(409).json({ error: "Import already in progress." });
  importLock = true;

  try {
    if (!req.file?.path) return res.status(400).json({ error: "No file uploaded" });

    const wb = xlsx.readFile(req.file.path);
    const sheet = wb.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheet], { defval: "" });

    const seen = new Set();
    const duplicates = [];
    const docs = [];

    for (const r of rows) {
      const d = makeDocFromRow(r);

      // If your schema requires 'code', skip rows without it
      if (!d.code) continue;

      if (seen.has(d.code)) {
        duplicates.push(d.code);
        continue;
      }
      seen.add(d.code);
      docs.push(d);
    }

    // 1) Replace/Upsert each row exactly as in Excel (no $set/$push — full replacement)
    const ops = docs.map((d) => ({
      replaceOne: {
        filter: { code: d.code },
        replacement: d,
        upsert: true,
      },
    }));
    if (ops.length) await Item.bulkWrite(ops, { ordered: false });

    // 2) Remove anything not present in the file
    await Item.deleteMany({ code: { $nin: Array.from(seen) } });

    const total = await Item.countDocuments();
    res.json({
      message: "✅ Mirror import complete. DB now matches the Excel file.",
      insertedOrReplaced: docs.length,
      removedNotInFile: true,
      duplicateCodesSkipped: Array.from(new Set(duplicates)),
      totalItems: total,
    });
  } catch (err) {
    console.error("Import error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    importLock = false;
    if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
  }
});

module.exports = router;
