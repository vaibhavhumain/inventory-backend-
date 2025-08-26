const ExcelJS = require("exceljs");
const StockLedger = require("../models/stockLedgerModel");
const Item = require("../models/itemModel");
const IssueBill = require("../models/issueBillModel");
const PurchaseBill = require("../models/purchaseBillModel");

const IST = "Asia/Kolkata";
const fmt = (d) => new Date(d).toLocaleString("en-IN", { timeZone: IST });

exports.exportDataByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const startDate = new Date(date);
    if (isNaN(startDate.getTime())) {
      return res.status(400).json({ error: "Invalid date. Use YYYY-MM-DD." });
    }
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    // Fetch (lean for plain objects)
    const [stockLedger, items, issueBills, purchaseBills] = await Promise.all([
      StockLedger.find({ date: { $gte: startDate, $lte: endDate } }).lean(),
      Item.find({ createdAt: { $gte: startDate, $lte: endDate } }).lean(),
      IssueBill.find({ createdAt: { $gte: startDate, $lte: endDate } })
        .populate("items.item")
        .lean(),
      PurchaseBill.find({ createdAt: { $gte: startDate, $lte: endDate } })
        .populate("items.item")
        .lean(),
    ]);

    const workbook = new ExcelJS.Workbook();

    // STOCK LEDGER
    const ledgerSheet = workbook.addWorksheet("Stock Ledger");
    ledgerSheet.columns = [
      { header: "Item Name", key: "itemName", width: 28 },
      { header: "Quantity", key: "quantity", width: 14 },
      { header: "Type", key: "type", width: 12 },
      { header: "Date", key: "date", width: 22 },
      { header: "Remarks", key: "remarks", width: 30 },
    ];
    stockLedger.forEach((e) => {
      ledgerSheet.addRow({
        itemName: e.itemName || e.item?.description || e.item, // adapt to your schema
        quantity: e.quantity,
        type: e.type || e.txnType,
        date: e.date ? fmt(e.date) : "",
        remarks: e.remarks || "",
      });
    });

    // ITEMS
    const itemSheet = workbook.addWorksheet("Items");
    itemSheet.columns = [
      { header: "Code", key: "code", width: 18 },
      { header: "Category", key: "category", width: 20 },
      { header: "Description", key: "description", width: 36 },
      { header: "Closing Qty", key: "closingQty", width: 14 },
      { header: "Created At", key: "createdAt", width: 22 },
    ];
    items.forEach((e) =>
      itemSheet.addRow({
        code: e.code,
        category: e.category,
        description: e.description,
        closingQty: e.closingQty,
        createdAt: e.createdAt ? fmt(e.createdAt) : "",
      })
    );

    // ISSUE BILLS
    const issueSheet = workbook.addWorksheet("Issue Bills");
    issueSheet.columns = [
      { header: "Issue No", key: "issueNo", width: 16 },
      { header: "Department", key: "department", width: 20 },
      { header: "Issued By", key: "issuedBy", width: 22 },
      { header: "Created At", key: "createdAt", width: 22 },
      { header: "Items", key: "items", width: 60 },
    ];
    issueBills.forEach((b) => {
      issueSheet.addRow({
        issueNo: b.issueNo,
        department: b.department,
        issuedBy: b.issuedBy,
        createdAt: b.createdAt ? fmt(b.createdAt) : "",
        items:
          (b.items || [])
            .map((i) => {
              const name =
                i.item?.description || i.item?.code || i.itemName || "Item";
              return `${name} (x${i.quantity})`;
            })
            .join(", ") || "",
      });
    });

    // PURCHASE BILLS
    const purchaseSheet = workbook.addWorksheet("Purchase Bills");
    purchaseSheet.columns = [
      { header: "Bill No", key: "billNo", width: 16 },
      { header: "Supplier", key: "supplierName", width: 28 },
      { header: "Total Amount", key: "totalAmount", width: 18 },
      { header: "Created At", key: "createdAt", width: 22 },
      { header: "Items", key: "items", width: 60 },
    ];
    purchaseBills.forEach((b) => {
      purchaseSheet.addRow({
        billNo: b.billNo,
        supplierName: b.supplierName,
        totalAmount: b.totalAmount,
        createdAt: b.createdAt ? fmt(b.createdAt) : "",
        items:
          (b.items || [])
            .map((i) => {
              const name =
                i.item?.description || i.item?.code || i.itemName || "Item";
              return `${name} (x${i.quantity}) @${i.rate}`;
            })
            .join(", ") || "",
      });
    });

    // Optional: make headers bold
    [ledgerSheet, itemSheet, issueSheet, purchaseSheet].forEach((ws) => {
      ws.getRow(1).font = { bold: true };
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="inventory-${date}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Failed to export data" });
  }
};
