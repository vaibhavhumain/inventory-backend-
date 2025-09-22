const express = require('express');
const router = express.Router();

const {
  createIssueBill,
  getIssueBills,
  getIssueBillById,
} = require('../controllers/issueBillController');

router.post('/', createIssueBill);       
router.get('/', getIssueBills);         
router.get('/:id', getIssueBillById);    

module.exports = router;
