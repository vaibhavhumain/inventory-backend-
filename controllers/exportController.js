const ExcelJS = require("exceljs");
const PurchaseInvoice = require("../models/purchaseInvoice");
const IssueBill = require("../models/issueBill");
const Bus = require("../models/Bus");
const Vendor = require("../models/vendor");
const Item = require("../models/item");
const User = require("../models/User");
const { getAllItemsSummary } = require("../services/Stock");

const IST = "Asia/Kolkata";
const fmt = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { timeZone: IST }) : "";

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

    // --- Fetch all data
    const [
      purchaseInvoices,
      inventorySummaryRaw,
      issueBills,
      buses,
      vendors,
      items,
      users,
    ] = await Promise.all([
      PurchaseInvoice.find({ createdAt: { $gte: startDate, $lte: endDate } })
        .populate("items.item", "code headDescription subDescription unit hsnCode")
        .populate("vendor", "name code gstNumber")
        .lean(),

      getAllItemsSummary(),

      IssueBill.find({ issueDate: { $gte: startDate, $lte: endDate } })
        .populate("items.item", "code headDescription unit")
        .populate("bus", "busCode ownerName")
        .lean(),

      Bus.find().populate("issueBills", "voucherNumber issueDate").lean(),
      Vendor.find().lean(),
      Item.find().populate("vendor", "name code gstNumber").lean(),
      User.find().lean(),
    ]);

    // ✅ Clean up inventory summary
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

    // ---------------- 🧾 PURCHASE INVOICES ----------------
    const purchaseSheet = workbook.addWorksheet("Purchase Invoices");
    purchaseSheet.columns = [
      { header: "Invoice No", key: "invoiceNumber", width: 16 },
      { header: "Party Name", key: "partyName", width: 26 },
      { header: "Vendor Code", key: "vendorCode", width: 16 },
      { header: "Date", key: "date", width: 20 },
      { header: "Taxable Value", key: "totalTaxableValue", width: 18 },
      { header: "Total Value", key: "totalInvoiceValue", width: 18 },
    ];
    purchaseInvoices.forEach((inv) =>
      purchaseSheet.addRow({
        invoiceNumber: inv.invoiceNumber,
        partyName: inv.partyName,
        vendorCode: inv.vendor?.code || "",
        date: fmt(inv.date),
        totalTaxableValue: inv.totalTaxableValue || 0,
        totalInvoiceValue: inv.totalInvoiceValue || 0,
      })
    );

    // ---------------- 📦 INVOICE ITEMS ----------------
    const invItemsSheet = workbook.addWorksheet("Invoice Items");
    invItemsSheet.columns = [
      { header: "Invoice No", key: "invoiceNumber", width: 16 },
      { header: "Party Name", key: "partyName", width: 24 },
      { header: "Item Code", key: "code", width: 16 },
      { header: "Item", key: "item", width: 28 },
      { header: "Qty", key: "qty", width: 10 },
      { header: "Unit", key: "unit", width: 10 },
      { header: "Rate", key: "rate", width: 12 },
      { header: "Amount", key: "amount", width: 14 },
      { header: "HSN Code", key: "hsnCode", width: 14 },
    ];
    purchaseInvoices.forEach((inv) => {
      (inv.items || []).forEach((i) =>
        invItemsSheet.addRow({
          invoiceNumber: inv.invoiceNumber,
          partyName: inv.partyName,
          code: i.item?.code,
          item: i.item?.headDescription,
          qty: i.subQuantity,
          unit: i.subQuantityMeasurement,
          rate: i.rate,
          amount: i.amount,
          hsnCode: i.hsnCode,
        })
      );
    });

    // ---------------- 🧾 ISSUE BILLS ----------------
    const issueSheet = workbook.addWorksheet("Issue Bills");
    issueSheet.columns = [
      { header: "Voucher No", key: "voucherNumber", width: 16 },
      { header: "Voucher Date", key: "voucherDate", width: 20 },
      { header: "Date", key: "issueDate", width: 20 },
      { header: "Department", key: "department", width: 20 },
      { header: "Type", key: "type", width: 16 },
      { header: "Issued To", key: "issuedTo", width: 20 },
      { header: "Issued By", key: "issuedBy", width: 20 },
      { header: "Bus (Code - Owner)", key: "bus", width: 28 },
      { header: "Item Code", key: "itemCode", width: 16 },
      { header: "Item", key: "item", width: 26 },
      { header: "Qty", key: "qty", width: 10 },
      { header: "UQC", key: "unit", width: 10 },
      { header: "Rate", key: "rate", width: 10 },
      { header: "Amount", key: "amount", width: 14 },
    ];
    issueBills.forEach((b) => {
      (b.items || []).forEach((it) =>
        issueSheet.addRow({
          voucherNumber: b.voucherNumber,
          voucherDate: fmt(b.voucherDate),
          issueDate: fmt(b.issueDate),
          department: b.department,
          type: b.type,
          issuedTo: b.issuedTo || "-",
          issuedBy: b.issuedBy?.name || "-",
          bus: b.bus
            ? `${b.bus.busCode || ""} - ${b.bus.ownerName || ""}`
            : "-",
          itemCode: it.item?.code,
          item: it.item?.headDescription,
          qty: it.quantity,
          unit: it.item?.unit,
          rate: it.rate,
          amount: it.amount,
        })
      );
    });

    // ---------------- 📦 INVENTORY SUMMARY ----------------
    const invSheet = workbook.addWorksheet("Inventory Summary");
    invSheet.columns = [
      { header: "Item Code", key: "itemCode", width: 16 },
      { header: "Description", key: "description", width: 28 },
      { header: "Unit", key: "unit", width: 10 },
      { header: "Purchased", key: "purchaseQty", width: 14 },
      { header: "Issued to Sub", key: "issueQty", width: 14 },
      { header: "Consumed", key: "consumptionQty", width: 14 },
      { header: "Sold", key: "saleQty", width: 14 },
      { header: "Closing (Main)", key: "closingMain", width: 16 },
      { header: "Closing (Sub)", key: "closingSub", width: 16 },
      { header: "Total Closing", key: "closingTotal", width: 16 },
    ];
    inventorySummary.forEach((r) => invSheet.addRow(r));

    // ---------------- 🚍 BUSES ----------------
    const busSheet = workbook.addWorksheet("Buses");
    busSheet.columns = [
      { header: "Bus Code", key: "busCode", width: 20 },
      { header: "Owner Name", key: "ownerName", width: 20 },
      { header: "Chassis No", key: "chassisNo", width: 20 },
      { header: "Engine No", key: "engineNo", width: 20 },
      { header: "Model", key: "model", width: 10 },
      { header: "Issue Bill Count", key: "issueBills", width: 18 },
    ];
    buses.forEach((b) =>
      busSheet.addRow({
        busCode: b.busCode,
        ownerName: b.ownerName,
        chassisNo: b.chassisNo,
        engineNo: b.engineNo,
        model: b.model,
        issueBills: (b.issueBills || []).length,
      })
    );

    // ---------------- 🧾 VENDORS ----------------
    const vendorSheet = workbook.addWorksheet("Vendors");
    vendorSheet.columns = [
      { header: "Vendor Code", key: "code", width: 16 },
      { header: "Name", key: "name", width: 26 },
      { header: "GST Number", key: "gstNumber", width: 20 },
      { header: "State", key: "state", width: 20 },
      { header: "Address", key: "address", width: 30 },
    ];
    vendors.forEach((v) => vendorSheet.addRow(v));

    // ---------------- 🧱 ITEMS ----------------
    const itemSheet = workbook.addWorksheet("Items");
    itemSheet.columns = [
      { header: "Code", key: "code", width: 16 },
      { header: "Category", key: "category", width: 16 },
      { header: "Head Description", key: "headDescription", width: 28 },
      { header: "Sub Description", key: "subDescription", width: 28 },
      { header: "Unit", key: "unit", width: 10 },
      { header: "HSN", key: "hsnCode", width: 16 },
      { header: "GST %", key: "gstRate", width: 10 },
      { header: "Vendor", key: "vendor", width: 26 },
      { header: "Main Store Qty", key: "mainStoreQty", width: 16 },
      { header: "Sub Store Qty", key: "subStoreQty", width: 16 },
      { header: "Closing Qty", key: "closingQty", width: 16 },
    ];
    items.forEach((i) =>
      itemSheet.addRow({
        code: i.code,
        category: i.category,
        headDescription: i.headDescription,
        subDescription: i.subDescription,
        unit: i.unit,
        hsnCode: i.hsnCode,
        gstRate: i.gstRate,
        vendor: i.vendor?.name || "-",
        mainStoreQty: i.mainStoreQty,
        subStoreQty: i.subStoreQty,
        closingQty: i.closingQty,
      })
    );

    // ---------------- 👤 USERS ----------------
    const userSheet = workbook.addWorksheet("Users");
    userSheet.columns = [
      { header: "Name", key: "name", width: 20 },
      { header: "Username", key: "username", width: 20 },
      { header: "Email", key: "email", width: 26 },
      { header: "Role", key: "role", width: 16 },
      { header: "Created At", key: "createdAt", width: 22 },
    ];
    users.forEach((u) =>
      userSheet.addRow({
        name: u.name,
        username: u.username,
        email: u.email,
        role: u.role,
        createdAt: fmt(u.createdAt),
      })
    );

    // 🧩 Apply styling
    workbook.eachSheet((ws) => {
      ws.getRow(1).font = { bold: true };
      ws.columns.forEach((col) => {
        col.alignment = { vertical: "middle", horizontal: "left" };
      });
    });

    // ✅ Send file to client
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="complete-report-${from}_to_${to || from}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Failed to export data" });
  }
};
