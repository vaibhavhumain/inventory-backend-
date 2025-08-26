const express = require('express');
const router = express.Router();

const {
  createIssueBill,
  getIssueBills,
  getIssueBillById,
  updateIssueBill,
  deleteIssueBill,
} = require('../controllers/issueBillController');

router.post('/', createIssueBill);       
router.get('/', getIssueBills);         
router.get('/:id', getIssueBillById);    
router.put('/:id', updateIssueBill);    
router.delete('/:id', deleteIssueBill); 

module.exports = router;
