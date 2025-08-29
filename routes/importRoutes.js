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

router.post("/", upload.single("file"), async (req, res) => {
  try {
    console.log("File uploaded:", req.file);

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

    console.log("Parsed rows:", data.length);

    const today = new Date();

    for (let idx = 0; idx < data.length; idx++) {
      const row = data[idx];
      const qty = Number(row["Closing Quantity"]) || 0;
      const code = row["Code"]?.toString().trim() || `AUTO${idx + 1}`;

      const newData = {
        code,
        closingQty: qty,
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
          row["STORE LOCATION"] ||
          row["store location"] ||
          ""
        ).toString().trim(),
        remarks: (
          row["Remarks"] ||
          row["REMARKS"] ||
          row["remark"] ||
          row["REMARK"] ||
          ""
        ).toString().trim(),
      };

      const existing = await Item.findOne({ code });

      if (existing) {
        let inQty = 0, outQty = 0;

        if (qty > existing.closingQty) inQty = qty - existing.closingQty;
        if (qty < existing.closingQty) outQty = existing.closingQty - qty;

        await Item.updateOne(
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
              storeLocation: newData.storeLocation,
              remarks: newData.remarks
            },
            $push: { dailyStock: { date: today, in: inQty, out: outQty } }
          }
        );
      } else {
        await Item.create({
          ...newData,
          dailyStock: [{ date: today, in: qty, out: 0 }]
        });
      }
    }

    res.status(200).json({
      message: "✅ Items imported/updated successfully with history",
      count: data.length,
    });
  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/:code/history", async (req, res) => {
  try {
    const { code } = req.params;

    const item = await Item.findOne({ code });

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.status(200).json({
      code: item.code,
      description: item.description,
      closingQty: item.closingQty,
      history: item.dailyStock
    });
  } catch (error) {
    console.error("History fetch error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
