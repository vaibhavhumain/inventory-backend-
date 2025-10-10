const express = require('express');
const router = express.Router();

const {
  createIssueBill,
  getIssueBills,
  getIssueBillById,
  createMultiIssueBill,
  } = require('../controllers/issueBillController');
const { protect } = require("../middleware/authMiddleware");
router.post("/", protect, createIssueBill);
router.get('/', getIssueBills);         
router.get('/:id', getIssueBillById);    
router.post("/multi", protect, createMultiIssueBill);

module.exports = router;