const ExcelJS = require("exceljs");
const StockLedger = require("../models/stockLedger");
const Item = require("../models/item");
const IssueBill = require("../models/issueBill");
const PurchaseBill = require("../models/purchaseBill");

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

    // Fetch everything (lean for plain objects)
    const [stockLedger, items, issueBills, purchaseBills] = await Promise.all([
      StockLedger.find({ date: { $gte: startDate, $lte: endDate } }).lean(),
      Item.find().lean(), // ✅ all items, always latest values
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
      { header: "Item Code", key: "code", width: 16 },
      { header: "Item Description", key: "description", width: 28 },
      { header: "In", key: "in", width: 10 },
      { header: "Out", key: "out", width: 10 },
      { header: "Closing Qty", key: "closingQty", width: 14 },
      { header: "Date", key: "date", width: 22 },
      { header: "Remarks", key: "remarks", width: 30 },
    ];
    stockLedger.forEach((e) => {
      ledgerSheet.addRow({
        code: e.item?.code || "",
        description: e.item?.description || e.itemName || "",
        in: e.in || 0,
        out: e.out || 0,
        closingQty: e.closingQty,
        date: e.date ? fmt(e.date) : "",
        remarks: e.remarks || "",
      });
    });

    // ITEMS (latest snapshot)
    const itemSheet = workbook.addWorksheet("Items Snapshot");
    itemSheet.columns = [
      { header: "Code", key: "code", width: 18 },
      { header: "Category", key: "category", width: 20 },
      { header: "Description", key: "description", width: 36 },
      { header: "Main Store Qty", key: "mainStoreQty", width: 16 },
      { header: "Sub Store Qty", key: "subStoreQty", width: 16 },
      { header: "Closing Qty", key: "closingQty", width: 14 },
      { header: "Remarks", key: "remarks", width: 26 },
      { header: "Created At", key: "createdAt", width: 22 },
      { header: "Updated At", key: "updatedAt", width: 22 },
    ];
    items.forEach((e) =>
      itemSheet.addRow({
        code: e.code,
        category: e.category,
        description: e.description,
        mainStoreQty: e.mainStoreQty,
        subStoreQty: e.subStoreQty,
        closingQty: e.closingQty,
        remarks: e.remarks || "",
        createdAt: e.createdAt ? fmt(e.createdAt) : "",
        updatedAt: e.updatedAt ? fmt(e.updatedAt) : "",
      })
    );

    // ISSUE BILLS (for the date)
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
              return `${name} (x${i.quantity}) @${i.rate}`;
            })
            .join(", ") || "",
      });
    });

    // PURCHASE BILLS (for the date)
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

    // Style headers
    [ledgerSheet, itemSheet, issueSheet, purchaseSheet].forEach((ws) => {
      ws.getRow(1).font = { bold: true };
      ws.columns.forEach((col) => {
        col.alignment = { vertical: "middle", horizontal: "left" };
      });
    });

    // Send file
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="inventory-report-${date}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Failed to export data" });
  }
};
