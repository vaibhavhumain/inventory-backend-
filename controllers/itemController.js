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

exports.getItems = async (req, res) => {
  try {
    const items = await Item.find();
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getItemById = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const updatedItem = await Item.findByIdAndUpdate(
      req.params.id, req.body, { new: true, runValidators: true }
    );
    if (!updatedItem) return res.status(404).json({ error: 'Item not found' });
    res.status(200).json(updatedItem);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteItem = async (req, res) => {
  try {
    const deletedItem = await Item.findByIdAndDelete(req.params.id);
    if (!deletedItem) {
      return res.status(404).json({ error: "Item not found" });
    }
    res.status(200).json({ message: "Item deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.bulkUpdateItems = async (req, res) => {
  try {
    const { date, changes } = req.body;

    if (!date || !Array.isArray(changes)) {
      return res.status(400).json({ error: "Date and changes array are required" });
    }

    const updatedItems = [];

    for (const change of changes) {
      const { itemId, newQty } = change;
      const item = await Item.findById(itemId);
      if (!item) continue;

      const oldQty = item.closingQty || 0;
      const difference = newQty - oldQty;

      item.closingQty = newQty;
      if (difference !== 0) {
        item.dailyStock.push({
          date: new Date(date),
          in: difference > 0 ? difference : 0,
          out: difference < 0 ? Math.abs(difference) : 0,
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
