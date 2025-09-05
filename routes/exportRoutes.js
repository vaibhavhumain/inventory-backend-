const express = require("express");
const router = express.Router();
const { exportData } = require("../controllers/exportController");

router.get("/", exportData);

router.get("/:date", (req, res) => {
  req.query.from = req.params.date;
  req.query.to = req.params.date;
  return exportData(req, res);
});

module.exports = router;
