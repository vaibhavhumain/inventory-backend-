const express = require('express');
const router = express.Router();
const { getAllItemsSummary, getItemSummary } = require('../services/Stock');

// Get summary of all items (for Stock Summary Page)
router.get('/summary', async (req, res) => {
  try {
    const summary = await getAllItemsSummary();
    res.json(summary);
  } catch (err) {
    console.error("Error fetching stock summary:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get summary of single item by itemId
router.get('/summary/:itemId', async (req, res) => {
  try {
    const summary = await getItemSummary(req.params.itemId);
    res.json(summary);
  } catch (err) {
    console.error("Error fetching item summary:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
