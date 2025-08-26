const express = require("express");
const router = express.Router();
const { exportDataByDate } = require("../controllers/exportController");

router.get("/:date", exportDataByDate);

module.exports = router;
