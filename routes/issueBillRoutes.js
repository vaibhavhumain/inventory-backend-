const express = require('express');
const router = express.Router();

const {
  createIssueBill,
  getIssueBills,
  getIssueBillById,
} = require('../controllers/issueBillController');
const { protect } = require("../middleware/authMiddleware");
router.post("/", protect, createIssueBill);
router.get('/', getIssueBills);         
router.get('/:id', getIssueBillById);    

module.exports = router;
