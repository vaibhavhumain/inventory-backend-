const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs/promises");
const Item = require("../models/item");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

const val = (v) =>
  v === null || v === undefined ? undefined : String(v).trim();

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

function pick(row, keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "")
      return row[k];
  }
  const lower = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.toLowerCase(), v])
  );
  for (const k of keys.map((x) => x.toLowerCase())) {
    if (lower[k] !== undefined && lower[k] !== null && String(lower[k]).trim() !== "")
      return lower[k];
  }
  return undefined;
}

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file?.path) return res.status(400).json({ error: "No file uploaded" });

    const wb = xlsx.readFile(req.file.path, { cellDates: true });
    const sheetName = wb.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], {
      defval: "",
      raw: false,
    });

    const docs = [];
    const seenCodes = new Map(); 

    for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const excelRow = i + 2;

  let code = val(pick(r, ["Code", "CODE", "code", "Item Code", "ITEM CODE"]));
  if (code) {
    const count = (seenCodes.get(code) || 0) + 1;
    seenCodes.set(code, count);
    if (count > 1) code = `${code}__DUP-${count}`;
  } else {
    code = `ROW-${excelRow}`;
  }

  const closingQty = num(pick(r, ["Closing Quantity", "Closing Q", "closing qty"]));
  const mainStoreQty = num(pick(r, ["Main Store", "Main Store Qty"]));
  const subStoreQty = num(pick(r, ["Sub Store", "Sub Store Qty"]));

  const category = normalizeCategory(pick(r, ["CATEGORY", "Category"]));
  const description = val(pick(r, ["ITEM DESCRIPTION", "Description", "Item Description"]));
  const plantName = val(pick(r, ["PLANT NAME", "Plant", "Plant Name"]));
  const weight = num(pick(r, ["WEIGHT", "WEIGHT per sheet / pipe", "Weight"]));
  const unit = val(pick(r, ["UC", "UOM", "Unit"]));
  const stockTaken = val(pick(r, ["stock taken qt", "stock taken qty", "Stock Taken"]));
  const location = val(pick(r, ["Location", "LOCATION"]));
  const remarks = val(pick(r, ["Remarks", "REMARKS", "remark", "REMARK"]));

  const today = new Date();

  const doc = {
  code,
  excelRow,
  category,
  description,
  plantName,
  weight,
  unit,
  stockTaken,
  location,
  remarks,
  closingQty,
  mainStoreQty,
  subStoreQty,
  dailyStock: [
    {
      date: today,
      in: closingQty ?? 0,
      out: 0,
      closingQty: closingQty ?? 0,
      mainStoreQty: mainStoreQty ?? 0,
      subStoreQty: subStoreQty ?? 0,
    },
  ],
};

  docs.push(doc);
}


    // Mirror mode: wipe and insert exactly what we parsed
    await Item.deleteMany({});
    const result = await Item.insertMany(docs, { ordered: true });

    res.json({
      message: "✅ Imported exactly what was in the Excel (mirror mode).",
      parsedRows: rows.length,
      inserted: result.length,
      note:
        "Rows with missing/duplicate Code were still imported using generated codes (ROW-# or __DUP-n).",
    });
  } catch (err) {
    console.error("Import error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
  }
});

module.exports = router;

