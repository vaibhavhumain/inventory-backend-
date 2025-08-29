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
exports.updateItemByCode = async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.__v;

    const item = await Item.findOne({ code: req.params.code });
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const today = new Date();

    if (updateData.closingQty !== undefined) {
      const newQty = Number(updateData.closingQty);
      let inQty = 0, outQty = 0;

      if (newQty > item.closingQty) inQty = newQty - item.closingQty;
      if (newQty < item.closingQty) outQty = item.closingQty - newQty;

      item.closingQty = newQty;
      item.dailyStock.push({
        date: today,
        in: inQty,
        out: outQty,
        closingQty: newQty,   
      });
    }

    item.category = updateData.category ?? item.category;
    item.description = updateData.description ?? item.description;
    item.plantName = updateData.plantName ?? item.plantName;
    item.weight = updateData.weight ?? item.weight;
    item.unit = updateData.unit ?? item.unit;
    item.location = updateData.location ?? item.location;
    item.storeLocation = updateData.storeLocation ?? item.storeLocation;
    item.remarks = updateData.remarks ?? item.remarks;

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
