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

// 📌 Import Excel
router.post("/", upload.single("file"), async (req, res) => {
  try {
    console.log("File uploaded:", req.file);

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

    console.log("Parsed rows:", data.length);

    const today = new Date();
    const processedRows = [];

    for (let idx = 0; idx < data.length; idx++) {
      const row = data[idx];
      const qty = Number(row["Closing Quantity"] || row["Closing Q"]) || 0;

      // ✅ If no code provided, generate fallback
      let code = row["Code"]?.toString().trim();
      if (!code) {
        code = idx + 1;
      }

      // 🆕 Main & Sub store qty
      const mainStoreQty = Number(row["Main Store"]) || 0;
      const subStoreQty = Number(row["Sub Store"]) || 0;

      // 🆕 Suppliers (from Excel)
      const supplierName = (row["Supplier Name"] || "").trim();
      const supplierAmount = Number(row["Supplier Amount"]) || 0;
      let suppliers = [];
      let supplierHistory = [];

      if (supplierName) {
        suppliers.push({ name: supplierName, amount: supplierAmount });
        supplierHistory.push({
          supplierName,
          amount: supplierAmount,
          date: today
        });
      }

      const newData = {
        code,
        closingQty: qty,
        category: normalizeCategory(row["CATEGORY"]) || "",
        description: (row["ITEM DESCRIPTION"] || "").trim(),
        plantName: (row["PLANT NAME"] || "").trim(),
        weight: row["WEIGHT"] || row["WEIGHT per sheet / pipe"]
          ? Number(row["WEIGHT"] || row["WEIGHT per sheet / pipe"])
          : undefined,
        unit: (row["UC"] || row["UOM"] || "").trim(),
        stockTaken: (row["stock taken qt"] || row["stock taken qty"] || "").trim(),
        location: (row["Location"] || "").trim(),
        remarks: (
          row["Remarks"] ||
          row["REMARKS"] ||
          row["remark"] ||
          row["REMARK"] ||
          ""
        ).toString().trim(),

        mainStoreQty,
        subStoreQty,
        suppliers,
        supplierHistory
      };

      const existing = await Item.findOne({ code });

      if (existing) {
        let inQty = 0, outQty = 0;

        if (qty > existing.closingQty) inQty = qty - existing.closingQty;
        if (qty < existing.closingQty) outQty = existing.closingQty - qty;

        // Update existing item
        await Item.findOneAndUpdate(
          { code: existing.code },
          {
            $set: {
              closingQty: qty,
              category: newData.category,
              description: newData.description,
              plantName: newData.plantName,
              weight: newData.weight,
              unit: newData.unit,
              stockTaken: newData.stockTaken,
              location: newData.location,
              remarks: newData.remarks,
              mainStoreQty: newData.mainStoreQty,
              subStoreQty: newData.subStoreQty,
            },
            $push: {
              dailyStock: {
                date: today,
                in: inQty,
                out: outQty,
                closingQty: qty,
                mainStoreQty: newData.mainStoreQty,
                subStoreQty: newData.subStoreQty
              },
              ...(supplierName && {
                suppliers: { name: supplierName, amount: supplierAmount },
                supplierHistory: {
                  supplierName,
                  amount: supplierAmount,
                  date: today
                }
              })
            }
          },
          { new: true }
        );
      } else {
        // Create new item
        await Item.create({
          ...newData,
          dailyStock: [{
            date: today,
            in: qty,
            out: 0,
            closingQty: qty,
            mainStoreQty,
            subStoreQty
          }]
        });
      }

      processedRows.push({ row: idx + 1, code, description: newData.description });
    }

    const items = await Item.find();

    res.status(200).json({
      message: "✅ Items imported/updated successfully with history & suppliers",
      processed: data.length,
      details: processedRows,
      items
    });
  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;