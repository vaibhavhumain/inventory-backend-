const ExcelJS = require("exceljs");
const PurchaseInvoice = require("../models/purchaseInvoice");
const IssueBill = require("../models/issueBill");
const Bus = require("../models/Bus");
const Vendor = require("../models/vendor");
const Item = require("../models/item");
const { getAllItemsSummary } = require("../services/Stock");

const IST = "Asia/Kolkata";
const fmt = (d) => new Date(d).toLocaleString("en-IN", { timeZone: IST });

exports.exportData = async (req, res) => {
  try {
    let { from, to } = req.query;

    if (!from) {
      return res.status(400).json({ error: "Please provide ?from=YYYY-MM-DD" });
    }

    const startDate = new Date(from);
    const endDate = to ? new Date(to) : new Date(from);
    endDate.setHours(23, 59, 59, 999);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: "Invalid date(s). Use YYYY-MM-DD." });
    }

    // --- Fetch data
    const [purchaseInvoices, inventorySummaryRaw, issueBills, buses, vendors, items] =
      await Promise.all([
        PurchaseInvoice.find({ createdAt: { $gte: startDate, $lte: endDate } })
          .populate("items.item", "code headDescription subDescription unit hsnCode")
          .lean(),
        getAllItemsSummary(),
        IssueBill.find({ issueDate: { $gte: startDate, $lte: endDate } })
          .populate("items.item", "code headDescription")
          .populate("bus")
          .lean(),
        Bus.find().populate("issueBills").lean(),
        Vendor.find().lean(),
        Item.find().lean(),
      ]);

    // ✅ Aggregate totals per item for cleaner summary
    const inventorySummary = Object.values(
      inventorySummaryRaw.reduce((acc, r) => {
        const key = r.itemCode || "UNKNOWN";
        if (!acc[key]) {
          acc[key] = {
            itemCode: r.itemCode,
            description: r.description,
            unit: r.unit || "",
            purchaseQty: 0,
            issueQty: 0,
            consumptionQty: 0,
            saleQty: 0,
            closingMain: 0,
            closingSub: 0,
            closingTotal: 0,
          };
        }
        acc[key].purchaseQty += r.purchaseQty || 0;
        acc[key].issueQty += r.issueQty || 0;
        acc[key].consumptionQty += r.consumptionQty || 0;
        acc[key].saleQty += r.saleQty || 0;
        acc[key].closingMain = r.closingMain || acc[key].closingMain;
        acc[key].closingSub = r.closingSub || acc[key].closingSub;
        acc[key].closingTotal = r.closingTotal || acc[key].closingTotal;
        return acc;
      }, {})
    );

    const workbook = new ExcelJS.Workbook();

    // ---------------- Purchase Invoices ----------------
    const purchaseSheet = workbook.addWorksheet("Purchase Invoices");
    purchaseSheet.columns = [
      { header: "Invoice No", key: "invoiceNumber", width: 16 },
      { header: "Party Name", key: "partyName", width: 28 },
      { header: "Invoice Date", key: "date", width: 20 },
      { header: "Total Taxable Value", key: "totalTaxableValue", width: 22 },
      { header: "Total Invoice Value", key: "totalInvoiceValue", width: 22 },
    ];
    purchaseInvoices.forEach((inv) => {
      purchaseSheet.addRow({
        invoiceNumber: inv.invoiceNumber,
        partyName: inv.partyName,
        date: inv.date ? fmt(inv.date) : "",
        totalTaxableValue: inv.totalTaxableValue || 0,
        totalInvoiceValue: inv.totalInvoiceValue || 0,
      });
    });

    // ---------------- Invoice Items ----------------
    const itemSheet = workbook.addWorksheet("Invoice Items");
    itemSheet.columns = [
      { header: "Invoice No", key: "invoiceNumber", width: 16 },
      { header: "Party Name", key: "partyName", width: 28 },
      { header: "Item Code", key: "code", width: 16 },
      { header: "Item", key: "item", width: 22 },
      { header: "Description", key: "description", width: 36 },
      { header: "Qty", key: "subQuantity", width: 14 },
      { header: "Unit", key: "subQuantityMeasurement", width: 14 },
      { header: "Rate", key: "rate", width: 14 },
      { header: "Amount", key: "amount", width: 18 },
      { header: "HSN", key: "hsnCode", width: 16 },
    ];
    purchaseInvoices.forEach((inv) => {
      (inv.items || []).forEach((i) => {
        itemSheet.addRow({
          invoiceNumber: inv.invoiceNumber,
          partyName: inv.partyName,
          code: i.item?.code || "",
          item: i.item?.headDescription || "",
          description: i.overrideDescription || i.subDescription || "",
          subQuantity: i.subQuantity,
          subQuantityMeasurement: i.subQuantityMeasurement,
          hsnCode: i.hsnCode,
          rate: i.rate,
          amount: i.amount,
        });
      });
    });

    // ---------------- ✅ Inventory Summary (Fixed) ----------------
    const invSheet = workbook.addWorksheet("Inventory Summary");
    invSheet.columns = [
      { header: "Item Code", key: "itemCode", width: 16 },
      { header: "Description", key: "description", width: 26 },
      { header: "Unit", key: "unit", width: 12 },
      { header: "Purchase (In)", key: "purchaseQty", width: 18 },
      { header: "Issue to Sub Store", key: "issueQty", width: 20 },
      { header: "Consumption", key: "consumptionQty", width: 18 },
      { header: "Sale", key: "saleQty", width: 18 },
      { header: "Balance Main", key: "closingMain", width: 20 },
      { header: "Balance Sub", key: "closingSub", width: 20 },
      { header: "Balance Total", key: "closingTotal", width: 22 },
    ];
    inventorySummary.forEach((s) => invSheet.addRow(s));

    // ---------------- Issue Bills ----------------
    const issueSheet = workbook.addWorksheet("Issue Bills");
    issueSheet.columns = [
      { header: "Date", key: "issueDate", width: 16 },
      { header: "Department", key: "department", width: 20 },
      { header: "Type", key: "type", width: 16 },
      { header: "Item Code", key: "itemCode", width: 16 },
      { header: "Item", key: "item", width: 24 },
      { header: "Qty", key: "qty", width: 12 },
      { header: "Rate", key: "rate", width: 14 },
      { header: "Amount", key: "amount", width: 18 },
      { header: "Bus", key: "bus", width: 20 },
    ];
    issueBills.forEach((b) => {
      (b.items || []).forEach((it) =>
        issueSheet.addRow({
          issueDate: fmt(b.issueDate),
          department: b.department,
          type: b.type,
          itemCode: it.item?.code,
          item: it.item?.headDescription,
          qty: it.quantity,
          rate: it.rate,
          amount: it.amount,
          bus: b.bus?.chassisNumber || "",
        })
      );
    });

    // ---------------- Buses ----------------
    const busSheet = workbook.addWorksheet("Buses");
    busSheet.columns = [
      { header: "Chassis No", key: "chassisNumber", width: 20 },
      { header: "Engine No", key: "engineNumber", width: 20 },
      { header: "Model", key: "model", width: 20 },
      { header: "Remarks", key: "remarks", width: 30 },
      { header: "Issue Bills Count", key: "issueBills", width: 18 },
    ];
    buses.forEach((b) =>
      busSheet.addRow({
        chassisNumber: b.chassisNumber,
        engineNumber: b.engineNumber,
        model: b.model,
        remarks: b.remarks,
        issueBills: (b.issueBills || []).length,
      })
    );

    // ---------------- Vendors ----------------
    const vendorSheet = workbook.addWorksheet("Vendors");
    vendorSheet.columns = [
      { header: "Code", key: "code", width: 16 },
      { header: "Name", key: "name", width: 28 },
      { header: "GST", key: "gstNumber", width: 20 },
    ];
    vendors.forEach((v) =>
      vendorSheet.addRow({
        code: v.code,
        name: v.name,
        gstNumber: v.gstNumber,
      })
    );

    // ---------------- Items ----------------
    const itemsSheet = workbook.addWorksheet("Items");
    itemsSheet.columns = [
      { header: "Code", key: "code", width: 16 },
      { header: "Head Desc", key: "headDescription", width: 28 },
      { header: "Sub Desc", key: "subDescription", width: 28 },
      { header: "Unit", key: "unit", width: 12 },
      { header: "HSN Code", key: "hsnCode", width: 18 },
    ];
    items.forEach((i) => itemsSheet.addRow(i));

    // ---------------- Styling ----------------
    workbook.eachSheet((ws) => {
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
      `attachment; filename="portal-report-${from}_to_${to || from}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Failed to export data" });
  }
};
