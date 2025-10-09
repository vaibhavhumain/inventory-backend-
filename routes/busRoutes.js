const express = require("express");
const router = express.Router();
const {
  createBus,
  getBuses,
  getBusByCode,
  updateBus,
} = require("../controllers/busController");
const { protect } = require("../middleware/authMiddleware");

router.post("/", protect, createBus);
router.get("/", protect, getBuses);
router.get("/:code", protect, getBusByCode);
router.put("/:id", protect, updateBus);

module.exports = router;
