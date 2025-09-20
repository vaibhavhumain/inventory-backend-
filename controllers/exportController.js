const ExcelJS = require("exceljs");
const Item = require("../models/item");
const IssueBill = require("../models/issueBill");
const PurchaseInvoice = require("../models/purchaseInvoice");

const IST = "Asia/Kolkata";
const fmt = (d) => new Date(d).toLocaleString("en-IN", { timeZone: IST });

exports.exportData = async (req, res) => {
  try {
    let { from, to } = req.query;

    if (!from) {
      return res
        .status(400)
        .json({ error: "Please provide ?from=YYYY-MM-DD" });
    }

    const startDate = new Date(from);
    const endDate = to ? new Date(to) : new Date(from);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: "Invalid date(s). Use YYYY-MM-DD." });
    }

    endDate.setHours(23, 59, 59, 999);

    // Fetch from DB
    const [items, issueBills, purchaseInvoices] = await Promise.all([
      Item.find().lean(),
      IssueBill.find({ createdAt: { $gte: startDate, $lte: endDate } })
        .populate("items.item")
        .lean(),
      PurchaseInvoice.find({ createdAt: { $gte: startDate, $lte: endDate } })
        .lean(),
    ]);

    const workbook = new ExcelJS.Workbook();

    // === STOCK LEDGER ===
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

    // === ITEMS SNAPSHOT ===
    const itemSheet = workbook.addWorksheet("Items Snapshot");
    itemSheet.columns = [
      { header: "Code", key: "code", width: 18 },
      { header: "Category (HSN)", key: "hsnCode", width: 18 },
      { header: "Description", key: "description", width: 36 },
      { header: "Unit", key: "unit", width: 12 },
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
        hsnCode: e.category,
        description: e.description,
        unit: e.unit,
        mainStoreQty: e.mainStoreQty,
        subStoreQty: e.subStoreQty,
        closingQty: e.closingQty,
        remarks: e.remarks || "",
        createdAt: e.createdAt ? fmt(e.createdAt) : "",
        updatedAt: e.updatedAt ? fmt(e.updatedAt) : "",
      })
    );

    // === ISSUE BILLS ===
    const issueSheet = workbook.addWorksheet("Issue Bills");
    issueSheet.columns = [
      { header: "Department", key: "department", width: 20 },
      { header: "Issued By", key: "issuedBy", width: 22 },
      { header: "Created At", key: "createdAt", width: 22 },
      { header: "Items", key: "items", width: 80 },
    ];
    issueBills.forEach((b) => {
      issueSheet.addRow({
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

    // === PURCHASE INVOICES ===
    const purchaseSheet = workbook.addWorksheet("Purchase Invoices");
    purchaseSheet.columns = [
      { header: "Invoice No", key: "invoiceNumber", width: 16 },
      { header: "Party Name", key: "partyName", width: 28 },
      { header: "Invoice Value", key: "totalInvoiceValue", width: 18 },
      { header: "Date", key: "date", width: 22 },
      { header: "Items", key: "items", width: 80 },
    ];
    purchaseInvoices.forEach((inv) => {
      purchaseSheet.addRow({
        invoiceNumber: inv.invoiceNumber,
        partyName: inv.partyName,
        totalInvoiceValue: inv.totalInvoiceValue,
        date: inv.date ? fmt(inv.date) : "",
        items:
          (inv.items || [])
            .map((i) => {
              return `${i.item} (SubQty: ${i.subQuantity} ${i.subQuantityMeasurement}) @${i.rate}`;
            })
            .join(", ") || "",
      });
    });

    // === Style headers ===
    [ledgerSheet, itemSheet, issueSheet, purchaseSheet].forEach((ws) => {
      ws.getRow(1).font = { bold: true };
      ws.columns.forEach((col) => {
        col.alignment = { vertical: "middle", horizontal: "left" };
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="inventory-report-${from}_to_${to || from}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Failed to export data" });
  }
};
