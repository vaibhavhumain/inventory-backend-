const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs/promises");
const Item = require("../models/item");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// helpers
const val = (v) =>
  v === null || v === undefined ? "" : String(v).trim();
const num = (v) => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file?.path)
      return res.status(400).json({ error: "No file uploaded" });

    const wb = xlsx.readFile(req.file.path, { cellDates: true });
    const sheetName = wb.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], {
      defval: "",
      raw: false,
    });

    const today = new Date();
    const docs = rows.map((r, i) => {
      // fallback code if missing
      const code = val(r["Code"]) || `ROW-${i + 2}`;

      const category = val(r["CATEGORY"]);
      const description = val(r["ITEM DESCRIPTION"]);
      const plantName = val(r["PLANT NAME"]);
      const weight = num(r["WEIGHT per sheet / pipe"]);
      const unit = val(r["UOM"]);
      const closingQty = num(r["Closing Quantity"] || r["Closing Quan"]);
      const mainStoreQty = num(r["Main Store"]);
      const subStoreQty = num(r["Sub Store"]);
      const stockTaken = val(r["stock taken d"]);
      const location = val(r["Location"]);
      const remarks = val(r["Remarks"]);

      const suppliers = [];
      if (r["Supplier 1 Name"] && r["Supplier 1 Amount"]) {
        suppliers.push({
          name: val(r["Supplier 1 Name"]),
          amount: num(r["Supplier 1 Amount"]),
        });
      }
      if (r["Supplier 2 Name"] && r["Supplier 2 Amount"]) {
        suppliers.push({
          name: val(r["Supplier 2 Name"]),
          amount: num(r["Supplier 2 Amount"]),
        });
      }

      return {
        code,
        category,
        description,
        plantName,
        weight,
        unit,
        closingQty,
        mainStoreQty,
        subStoreQty,
        stockTaken,
        location,
        remarks,
        suppliers,
        supplierHistory: suppliers.map((s) => ({
          supplierName: s.name,
          amount: s.amount,
          date: today,
        })),
        dailyStock: [
          {
            date: today,
            in: closingQty || 0,
            out: 0,
            closingQty: closingQty || 0,
            mainStoreQty: mainStoreQty || 0,
            subStoreQty: subStoreQty || 0,
          },
        ],
      };
    });

    await Item.deleteMany({});
    const result = await Item.insertMany(docs, { ordered: true });

    res.json({
      message: "✅ Excel imported & mapped successfully",
      parsedRows: rows.length,
      inserted: result.length,
    });
  } catch (err) {
    console.error("Import error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
  }
});

module.exports = router;
