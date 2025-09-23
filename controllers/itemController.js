const Item = require('../models/item');

exports.createItem = async (req, res) => {
  try {
    const { category, headDescription, subDescription, unit, hsnCode, remarks, vendor } = req.body;

    if (!headDescription) {
      return res.status(400).json({ error: "headDescription is required" });
    }
    if (!category) {
      return res.status(400).json({ error: "category is required" });
    }

    const newItem = new Item({
      category,
      headDescription,
      subDescription,
      unit: unit || "pcs",
      hsnCode,
      remarks,
      vendor
    });

    await newItem.save();
    res.status(201).json(newItem);
  } catch (err) {
    console.error("Error creating item:", err);
    res.status(400).json({ error: err.message });
  }
};

exports.getItems = async (req, res) => {
  try {
    const items = await Item.find();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteItem = async (req, res) => {
  try {
    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
