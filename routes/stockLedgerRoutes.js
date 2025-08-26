const express = require("express");
const router = express.Router();
const {
  feedStock,
  issueStock,
  getStocks,
  getStockByItem,
  getStockByDate,
  deleteStock
} = require("../controllers/stockLedgerController");

router.post("/feed", feedStock);              
router.post("/issue", issueStock);            
router.get("/", getStocks);                  
router.get("/item/:itemName", getStockByItem);
router.get("/date/:date", getStockByDate);    
router.delete("/:id", deleteStock);           
module.exports = router;
 