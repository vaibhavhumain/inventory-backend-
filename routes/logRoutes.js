const express = require("express");
const router = express.Router();
const Log = require("../models/Log");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post("/frontend", protect, async (req, res) => {
  try {
    const { level, message, meta } = req.body;
    const user = req.user?.name || "Anonymous";
    await Log.create({ source: "frontend", level, message, user, meta });
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to store frontend log" });
  }
});

router.get("/", protect, authorize("developer"), async (req, res) => {
  const logs = await Log.find().sort({ createdAt: -1 }).limit(500);
  res.json(logs);
});

router.delete("/", protect, authorize("developer"), async (req, res) => {
  await Log.deleteMany({});
  res.json({ message: "Logs cleared successfully" });
});

module.exports = router;
