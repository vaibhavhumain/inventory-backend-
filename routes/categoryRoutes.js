const express = require("express");
const router = express.Router();
const Category = require("../models/Category");

// list
router.get("/", async (req, res) => {
  const cats = await Category.find({ isActive: true }).sort({ label: 1 });
  res.json(cats);
});

// create
router.post("/", async (req, res, next) => {
  try {
    const { label, prefix } = req.body;
    if (!label?.trim() || !prefix?.trim())
      return res.status(400).json({ error: "label and prefix are required" });

    const name = label.trim().toLowerCase();
    const cat = await Category.create({
      name,
      label: label.trim(),
      prefix: prefix.trim().toUpperCase(),
    });
    res.status(201).json(cat);
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ error: "Category name or prefix already exists" });
    }
    next(e);
  }
});

module.exports = router;
