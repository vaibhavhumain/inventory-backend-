const ExcelJS = require("exceljs");
const StockLedger = require("../models/stockLedgerModel");
const Item = require("../models/itemModel");
const IssueBill = require("../models/issueBillModel");
const PurchaseBill = require("../models/purchaseBillModel");

exports.exportDataByDate = async (req, res) => {
  try {
    const { date } = req.params; 
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const stockLedger = await StockLedger.find({ date: { $gte: startDate, $lte: endDate } });
    const items = await Item.find({ createdAt: { $gte: startDate, $lte: endDate } });
    const issueBills = await IssueBill.find({ createdAt: { $gte: startDate, $lte: endDate } }).populate("items.item");
    const purchaseBills = await PurchaseBill.find({ createdAt: { $gte: startDate, $lte: endDate } }).populate("items.item");

    const workbook = new ExcelJS.Workbook();

    const ledgerSheet = workbook.addWorksheet("Stock Ledger");
    ledgerSheet.columns = [
      { header: "Item Name", key: "itemName", width: 20 },
      { header: "Quantity", key: "quantity", width: 15 },
      { header: "Type", key: "type", width: 10 },
      { header: "Date", key: "date", width: 20 },
    ];
    stockLedger.forEach(entry => ledgerSheet.addRow(entry));

    const itemSheet = workbook.addWorksheet("Items");
    itemSheet.columns = [
      { header: "Code", key: "code", width: 15 },
      { header: "Category", key: "category", width: 20 },
      { header: "Description", key: "description", width: 25 },
      { header: "Closing Qty", key: "closingQty", width: 15 },
      { header: "Created At", key: "createdAt", width: 20 },
    ];
    items.forEach(entry => itemSheet.addRow(entry));

    const issueSheet = workbook.addWorksheet("Issue Bills");
    issueSheet.columns = [
      { header: "Issue No", key: "issueNo", width: 15 },
      { header: "Department", key: "department", width: 20 },
      { header: "Issued By", key: "issuedBy", width: 20 },
      { header: "Created At", key: "createdAt", width: 20 },
      { header: "Items", key: "items", width: 50 },
    ];
    issueBills.forEach(bill => {
      issueSheet.addRow({
        issueNo: bill.issueNo,
        department: bill.department,
        issuedBy: bill.issuedBy,
        createdAt: bill.createdAt,
        items: bill.items.map(i => `${i.item.description} (x${i.quantity})`).join(", "),
      });
    });

    const purchaseSheet = workbook.addWorksheet("Purchase Bills");
    purchaseSheet.columns = [
      { header: "Bill No", key: "billNo", width: 15 },
      { header: "Supplier", key: "supplierName", width: 25 },
      { header: "Total Amount", key: "totalAmount", width: 20 },
      { header: "Created At", key: "createdAt", width: 20 },
      { header: "Items", key: "items", width: 50 },
    ];
    purchaseBills.forEach(bill => {
      purchaseSheet.addRow({
        billNo: bill.billNo,
        supplierName: bill.supplierName,
        totalAmount: bill.totalAmount,
        createdAt: bill.createdAt,
        items: bill.items.map(i => `${i.item.description} (x${i.quantity}) @${i.rate}`).join(", "),
      });
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=data-${date}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Failed to export data" });
  }
};
