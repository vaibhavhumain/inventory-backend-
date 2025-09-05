const ExcelJS = require("exceljs");
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

    // Fetch items + bills
    const [items, issueBills, purchaseBills] = await Promise.all([
      Item.find().lean(), // ✅ items contain dailyStock + supplierHistory
      IssueBill.find({ createdAt: { $gte: startDate, $lte: endDate } })
        .populate("items.item")
        .lean(),
      PurchaseBill.find({ createdAt: { $gte: startDate, $lte: endDate } })
        .populate("items.item")
        .lean(),
    ]);

    const workbook = new ExcelJS.Workbook();

    // STOCK LEDGER (from item.dailyStock filtered by date)
    const ledgerSheet = workbook.addWorksheet("Stock Ledger");
    ledgerSheet.columns = [
      { header: "Item Code", key: "code", width: 16 },
      { header: "Item Description", key: "description", width: 28 },
      { header: "In", key: "in", width: 10 },
      { header: "Out", key: "out", width: 10 },
      { header: "Closing Qty", key: "closingQty", width: 14 },
      { header: "Main Store", key: "mainStoreQty", width: 14 },
      { header: "Sub Store", key: "subStoreQty", width: 14 },
      { header: "Date", key: "date", width: 22 },
      { header: "Remarks", key: "remarks", width: 30 },
    ];

    items.forEach((item) => {
      (item.dailyStock || []).forEach((ds) => {
        if (ds.date >= startDate && ds.date <= endDate) {
          ledgerSheet.addRow({
            code: item.code,
            description: item.description,
            in: ds.in || 0,
            out: ds.out || 0,
            closingQty: ds.closingQty,
            mainStoreQty: ds.mainStoreQty,
            subStoreQty: ds.subStoreQty,
            date: ds.date ? fmt(ds.date) : "",
            remarks: item.remarks || "",
          });
        }
      });
    });

    // ITEMS SNAPSHOT
    const itemSheet = workbook.addWorksheet("Items Snapshot");
    itemSheet.columns = [
      { header: "Code", key: "code", width: 18 },
      { header: "Category", key: "category", width: 20 },
      { header: "Description", key: "description", width: 36 },
      { header: "Plant", key: "plantName", width: 20 },
      { header: "Weight", key: "weight", width: 14 },
      { header: "Unit", key: "unit", width: 10 },
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
        plantName: e.plantName,
        weight: e.weight,
        unit: e.unit,
        mainStoreQty: e.mainStoreQty,
        subStoreQty: e.subStoreQty,
        closingQty: e.closingQty,
        remarks: e.remarks || "",
        createdAt: e.createdAt ? fmt(e.createdAt) : "",
        updatedAt: e.updatedAt ? fmt(e.updatedAt) : "",
      })
    );

    // SUPPLIER HISTORY
    const supplierSheet = workbook.addWorksheet("Supplier History");
    supplierSheet.columns = [
      { header: "Item Code", key: "code", width: 18 },
      { header: "Item Description", key: "description", width: 30 },
      { header: "Supplier", key: "supplierName", width: 28 },
      { header: "Amount", key: "amount", width: 18 },
      { header: "Date", key: "date", width: 22 },
    ];
    items.forEach((item) => {
      (item.supplierHistory || []).forEach((sh) => {
        if (sh.date >= startDate && sh.date <= endDate) {
          supplierSheet.addRow({
            code: item.code,
            description: item.description,
            supplierName: sh.supplierName,
            amount: sh.amount,
            date: sh.date ? fmt(sh.date) : "",
          });
        }
      });
    });

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
              return `${name} (x${i.quantity}) @${i.rate}`;
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

    // Style headers
    [ledgerSheet, itemSheet, supplierSheet, issueSheet, purchaseSheet].forEach(
      (ws) => {
        ws.getRow(1).font = { bold: true };
        ws.columns.forEach((col) => {
          col.alignment = { vertical: "middle", horizontal: "left" };
        });
      }
    );

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
