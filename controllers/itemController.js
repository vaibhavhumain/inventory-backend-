const Item = require('../models/item');

const categoryPrefixes = {
  "raw material": "RM",
  "consumables": "CON",
  "bought out": "BOP",
  "hardware": "HW",
  "electronics": "ES",
  "electricals": "EL",
  "paints": "PT",
  "rubbers": "RB",
  "chemicals": "CH",
  "adhesive": "AD",
  "plastics": "PL",
  "furniture": "FR"
};

// ✅ Create Item
exports.createItem = async (req, res) => {
  try {
    let { code, category, description, plantName, weight, unit, closingQty, stockTaken, location } = req.body;
    category = category.toLowerCase().trim();

    const prefix = categoryPrefixes[category];
    if (!prefix) return res.status(400).json({ error: `Invalid category: ${category}` });

    const lastItem = await Item.findOne({ category })
      .sort({ code: -1 })
      .collation({ locale: "en", numericOrdering: true });

    let newCode;
    if (!lastItem) {
      newCode = `${prefix}0001`;
    } else {
      const match = lastItem.code.match(/(\d+)$/);
      const lastNum = match ? parseInt(match[1]) : 0;
      newCode = `${prefix}${String(lastNum + 1).padStart(4, "0")}`;
    }

    if (!code || (await Item.findOne({ category, code }))) code = newCode;

    const item = await Item.create({
      code, category, description, plantName, weight, unit, closingQty, stockTaken, location
    });

    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ✅ Get all items
exports.getItems = async (req, res) => {
  try {
    const items = await Item.find();
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Get item by CODE (not _id)
exports.getItemByCode = async (req, res) => {
  try {
    const item = await Item.findOne({ code: req.params.code });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Update item by CODE
// ✅ Update item by CODE (with main/sub store handling)
exports.updateItemByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const { description, category, plantName, weight, unit, remarks, addQty, targetStore } = req.body;

    let { mainStoreQty, subStoreQty } = req.body;

    const item = await Item.findOne({ code });
    if (!item) return res.status(404).json({ error: "Item not found" });

    const today = new Date();

    // If addQty + targetStore provided → increment logic
    if (addQty && targetStore) {
      if (targetStore === "Main Store") {
        mainStoreQty = (item.mainStoreQty || 0) + Number(addQty);
        subStoreQty = item.subStoreQty || 0;
      } else if (targetStore === "Sub Store") {
        subStoreQty = (item.subStoreQty || 0) + Number(addQty);
        mainStoreQty = item.mainStoreQty || 0;
      }
    } else {
      // Otherwise, fall back to provided absolute values
      mainStoreQty = mainStoreQty ?? item.mainStoreQty;
      subStoreQty = subStoreQty ?? item.subStoreQty;
    }

    // Always recalc closing qty
    const newClosing = Number(mainStoreQty) + Number(subStoreQty);
    const oldClosing = item.closingQty || 0;

    let inQty = 0, outQty = 0;
    if (newClosing > oldClosing) inQty = newClosing - oldClosing;
    if (newClosing < oldClosing) outQty = oldClosing - newClosing;

    // Apply updates
    item.description = description ?? item.description;
    item.category = category ?? item.category;
    item.plantName = plantName ?? item.plantName;
    item.weight = weight ?? item.weight;
    item.unit = unit ?? item.unit;
    item.remarks = remarks ?? item.remarks;

    item.mainStoreQty = mainStoreQty;
    item.subStoreQty = subStoreQty;
    item.closingQty = newClosing;

    if (inQty !== 0 || outQty !== 0) {
      item.dailyStock.push({
        date: today,
        in: inQty,
        out: outQty,
        closingQty: newClosing
      });
    }

    await item.save();
    res.status(200).json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ✅ Delete item by CODE
exports.deleteItemByCode = async (req, res) => {
  try {
    const deletedItem = await Item.findOneAndDelete({ code: req.params.code });
    if (!deletedItem) {
      return res.status(404).json({ error: "Item not found" });
    }
    res.status(200).json({ message: "Item deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Bulk update by itemId (still uses _id internally)
exports.bulkUpdateItems = async (req, res) => {
  try {
    const { date, changes } = req.body;

    if (!date || !Array.isArray(changes)) {
      return res.status(400).json({ error: "Date and changes array are required" });
    }

    const updatedItems = [];

    for (const change of changes) {
      const { code, newQty } = change; 
      const item = await Item.findOne({ code });
      if (!item) continue;

      const oldQty = item.closingQty || 0;
      const difference = newQty - oldQty;

      item.closingQty = newQty;
      if (difference !== 0) {
        item.dailyStock.push({
          date: new Date(date),
          in: difference > 0 ? difference : 0,
          out: difference < 0 ? Math.abs(difference) : 0,
          closingQty: newQty,
        });
      }

      await item.save();
      updatedItems.push(item);
    }

    res.status(200).json({
      message: "✅ Items updated successfully",
      count: updatedItems.length,
      items: updatedItems,
    });
  } catch (error) {
    console.error("Bulk update error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ✅ Get stock history by CODE
exports.getItemHistory = async (req, res) => {
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
};
