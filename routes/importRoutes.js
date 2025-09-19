const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs/promises");
const Item = require("../models/item");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// helper to trim values
const val = (v) =>
  v === null || v === undefined ? "" : String(v).trim();

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file?.path)
      return res.status(400).json({ error: "No file uploaded" });

    const wb = xlsx.readFile(req.file.path, { cellDates: true });
    const sheetName = wb.SheetNames[0];
    // keep values as strings (so leading zeros are preserved)
    const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], {
      defval: "",
      raw: false,
    });

    // ⚠️ delete all items before inserting (mirror mode)
    await Item.deleteMany({});

    // insert rows exactly as they appear
    const result = await Item.insertMany(rows, { ordered: false });

    res.json({
      message: "✅ Imported Excel as-is (mirror mode).",
      parsedRows: rows.length,
      inserted: result.length,
      note: "No cleaning or auto-generation was done. Data is stored exactly like Excel.",
    });
  } catch (err) {
    console.error("Import error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
  }
});

module.exports = router;
