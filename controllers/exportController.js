const ExcelJS = require("exceljs");
const PurchaseInvoice = require("../models/purchaseInvoice");
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

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: "Invalid date(s). Use YYYY-MM-DD." });
    }

    endDate.setHours(23, 59, 59, 999);

    const purchaseInvoices = await PurchaseInvoice.find({
      createdAt: { $gte: startDate, $lte: endDate },
    })
      .populate("items.item", "name unit") 
      .lean();

    const inventorySummary = await getAllItemsSummary();

    const workbook = new ExcelJS.Workbook();

    const purchaseSheet = workbook.addWorksheet("Purchase Invoices");
    purchaseSheet.columns = [
      { header: "Invoice No", key: "invoiceNumber", width: 16 },
      { header: "Party Name", key: "partyName", width: 28 },
      { header: "Invoice Date", key: "date", width: 20 },
      { header: "Other Charges Before Tax (Amt)", key: "otherChargesBeforeTaxAmount", width: 22 },
      { header: "Other Charges Before Tax (%)", key: "otherChargesBeforeTaxPercent", width: 22 },
      { header: "GST on Before Tax Charges (%)", key: "otherChargesBeforeTaxGstRate", width: 26 },
      { header: "Other Charges After Tax", key: "otherChargesAfterTax", width: 22 },
      { header: "Total Taxable Value", key: "totalTaxableValue", width: 22 },
      { header: "Total Invoice Value", key: "totalInvoiceValue", width: 22 },
    ];

    purchaseInvoices.forEach((inv) => {
      purchaseSheet.addRow({
        invoiceNumber: inv.invoiceNumber,
        partyName: inv.partyName,
        date: inv.date ? fmt(inv.date) : "",
        otherChargesBeforeTaxAmount: inv.otherChargesBeforeTaxAmount || 0,
        otherChargesBeforeTaxPercent: inv.otherChargesBeforeTaxPercent || 0,
        otherChargesBeforeTaxGstRate: inv.otherChargesBeforeTaxGstRate || 0,
        otherChargesAfterTax: inv.otherChargesAfterTax || 0,
        totalTaxableValue: inv.totalTaxableValue || 0,
        totalInvoiceValue: inv.totalInvoiceValue || 0,
      });
    });

    const itemSheet = workbook.addWorksheet("Invoice Items");
    itemSheet.columns = [
      { header: "Invoice No", key: "invoiceNumber", width: 16 },
      { header: "Party Name", key: "partyName", width: 28 },
      { header: "Item", key: "item", width: 22 },
      { header: "Description", key: "description", width: 36 },
      { header: "Head Qty", key: "headQuantity", width: 14 },
      { header: "Head UOM", key: "headQuantityMeasurement", width: 14 },
      { header: "Sub Qty", key: "subQuantity", width: 14 },
      { header: "Sub UOM", key: "subQuantityMeasurement", width: 14 },
      { header: "HSN Code", key: "hsnCode", width: 16 },
      { header: "Rate", key: "rate", width: 14 },
      { header: "Amount", key: "amount", width: 18 },
      { header: "GST %", key: "gstRate", width: 12 },
      { header: "Notes", key: "notes", width: 30 },
    ];

    purchaseInvoices.forEach((inv) => {
      (inv.items || []).forEach((i) => {
        itemSheet.addRow({
          invoiceNumber: inv.invoiceNumber,
          partyName: inv.partyName,
          item: i.item?.name || "", 
          description: i.description,
          headQuantity: i.headQuantity,
          headQuantityMeasurement: i.headQuantityMeasurement,
          subQuantity: i.subQuantity,
          subQuantityMeasurement: i.subQuantityMeasurement,
          hsnCode: i.hsnCode,
          rate: i.rate,
          amount: i.amount,
          gstRate: i.gstRate,
          notes: i.notes || "",
        });
      });
    });

    const invSheet = workbook.addWorksheet("Inventory Summary");
    invSheet.columns = [
      { header: "Item", key: "itemName", width: 22 },
      { header: "Unit", key: "unit", width: 12 },
      { header: "Purchase (In)", key: "purchaseIn", width: 18 },
      { header: "Issue to Sub Store", key: "issueToSub", width: 20 },
      { header: "Consumption", key: "consumption", width: 18 },
      { header: "Sale", key: "sale", width: 18 },
      { header: "Balance Main Store", key: "balanceMainStore", width: 20 },
      { header: "Balance Sub Store", key: "balanceSubStore", width: 20 },
      { header: "Balance Quantity (Total)", key: "balanceTotal", width: 22 },
    ];

    inventorySummary.forEach((s) => {
      invSheet.addRow({
        itemName: s.itemName,
        unit: s.unit,
        purchaseIn: s.purchaseIn || 0,
        issueToSub: s.issueToSub || 0,
        consumption: s.consumption || 0,
        sale: s.sale || 0,
        balanceMainStore: s.balanceMainStore || 0,
        balanceSubStore: s.balanceSubStore || 0,
        balanceTotal: s.balanceTotal || 0,
      });
    });

    [purchaseSheet, itemSheet, invSheet].forEach((ws) => {
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
      `attachment; filename="purchase-invoices-${from}_to_${to || from}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Failed to export data" });
  }
};
