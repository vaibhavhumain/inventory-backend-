const PurchaseInvoice = require("../models/purchaseInvoice");
const Item = require("../models/item");
const InventoryTransaction = require("../models/InventoryTransaction");
const XLSX = require("xlsx");

const categoryPrefixes = {
  "raw material": "RM",
  consumables: "CON",
  "bought out": "BOP",
  hardware: "HW",
  electronics: "ES",
  electricals: "EL",
  paints: "PT",
  rubbers: "RB",
  chemicals: "CH",
  adhesive: "AD",
  plastics: "PL",
  furniture: "FR",
};

async function generateItemCode(category) {
  const safeCategory = category?.toLowerCase() || "raw material";
  const prefix = categoryPrefixes[safeCategory] || "ITM";
  const lastItem = await Item.findOne({ category: safeCategory })
    .sort({ code: -1 })
    .collation({ locale: "en", numericOrdering: true });

  let newCode;
  if (!lastItem) {
    newCode = `${prefix}0001`;
  } else {
    const match = lastItem.code?.match(/(\d+)$/);
    const lastNum = match ? parseInt(match[1], 10) : 0;
    newCode = `${prefix}${String(lastNum + 1).padStart(4, "0")}`;
  }
  return newCode;
}

async function processItems(items) {
  let totalTaxableValue = 0;
  let gstTotal = 0;
  const processedItems = [];

  for (const it of items) {
    const headDescription = it.headDescription || it.item || it.overrideDescription;
    if (!headDescription) throw new Error("Head Description is required");

    const safeCategory = it.category?.toLowerCase().trim() || "raw material";
    const amount = (it.subQuantity || 0) * (it.rate || 0);
    totalTaxableValue += amount;
    if (it.gstRate) gstTotal += (amount * it.gstRate) / 100;

    let existingItem = await Item.findOne({ headDescription });
    if (!existingItem) {
      const code = await generateItemCode(safeCategory);
      existingItem = new Item({
        code,
        category: safeCategory,
        headDescription,
        subDescription: it.subDescription || "",
        unit: it.subQuantityMeasurement,
        hsnCode: it.hsnCode,
        closingQty: it.subQuantity,
        mainStoreQty: it.subQuantity,
        remarks: it.notes || null,
        dailyStock: [
          {
            date: new Date(),
            in: it.subQuantity,
            out: 0,
            closingQty: it.subQuantity,
            mainStoreQty: it.subQuantity,
            subStoreQty: 0,
          },
        ],
      });
      await existingItem.save();
    } else {
      existingItem.closingQty += it.subQuantity || 0;
      existingItem.mainStoreQty += it.subQuantity || 0;
      existingItem.dailyStock.push({
        date: new Date(),
        in: it.subQuantity || 0,
        out: 0,
        closingQty: existingItem.closingQty,
        mainStoreQty: existingItem.mainStoreQty,
        subStoreQty: existingItem.subStoreQty || 0,
      });
      await existingItem.save();
    }

    processedItems.push({
      item: existingItem._id,
      overrideDescription: it.overrideDescription || headDescription,
      headQuantity: it.headQuantity,
      headQuantityMeasurement: it.headQuantityMeasurement,
      subQuantity: it.subQuantity,
      subQuantityMeasurement: it.subQuantityMeasurement,
      hsnSnapshot: existingItem.hsnCode || "",
      rate: it.rate,
      amount,
      gstRate: it.gstRate,
      notes: it.notes,
    });
  }

  return { processedItems, totalTaxableValue, gstTotal };
}

exports.createPurchaseInvoice = async (req, res) => {
  try {
    const {
      invoiceNumber,
      date,
      partyName,
      vendor,
      items,
      otherChargesBeforeTaxAmount,
      otherChargesBeforeTaxPercent,
      otherChargesBeforeTaxGstRate,
      otherChargesAfterTax,
    } = req.body;

    if (!invoiceNumber || !partyName || !vendor || !items?.length) {
      return res.status(400).json({ error: "Invoice number, vendor, party name and items are required" });
    }

    // Process and save items
    const { processedItems, totalTaxableValue, gstTotal } = await processItems(items);

    const beforeTaxPercentValue =
      (totalTaxableValue * (otherChargesBeforeTaxPercent || 0)) / 100;
    const beforeTaxFixedValue = otherChargesBeforeTaxAmount || 0;
    const beforeTaxTotal = beforeTaxFixedValue + beforeTaxPercentValue;
    const beforeTaxGst = (beforeTaxTotal * (otherChargesBeforeTaxGstRate || 0)) / 100;

    const totalInvoiceValue =
      totalTaxableValue + beforeTaxTotal + gstTotal + beforeTaxGst + (otherChargesAfterTax || 0);

    const newInvoice = new PurchaseInvoice({
      invoiceNumber,
      date: date || new Date(),
      vendor,
      partyName,
      items: processedItems,
      otherChargesBeforeTaxAmount: beforeTaxFixedValue,
      otherChargesBeforeTaxPercent: otherChargesBeforeTaxPercent || 0,
      otherChargesBeforeTaxGstRate: otherChargesBeforeTaxGstRate || 0,
      otherChargesAfterTax: otherChargesAfterTax || 0,
      totalTaxableValue: totalTaxableValue + beforeTaxTotal,
      totalInvoiceValue,
    });

    await newInvoice.save();

    for (const it of processedItems) {
      const lineAmount = (it.subQuantity || 0) * (it.rate || 0);
      await InventoryTransaction.create({
        item: it.item,
        type: "PURCHASE",
        quantity: it.subQuantity,
        rate: it.rate,
        amount: lineAmount,
        date: new Date(date) || new Date(),
        meta: { invoice: newInvoice._id },
      });
    }

    res.status(201).json({ message: "Purchase Invoice Added", invoice: newInvoice });
  } catch (error) {
    console.error("Error adding purchase invoice:", error);
    res.status(500).json({ error: error.message });
  }
};


exports.getPurchaseInvoices = async (req, res) => {
  try {
    const invoices = await PurchaseInvoice.find()
      .populate("vendor", "code name gstNumber")
      .populate("items.item", "_id code headDescription subDescription category hsnCode");
    res.status(200).json(invoices);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.getPurchaseInvoiceById = async (req, res) => {
  try {
    const invoice = await PurchaseInvoice.findById(req.params.id)
      .populate("vendor", "code name gstNumber")
      .populate("items.item", "_id code headDescription subDescription category hsnCode");
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.status(200).json(invoice);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.updatePurchaseInvoice = async (req, res) => {
  try {
    const invoice = await PurchaseInvoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const {
      items,
      otherChargesBeforeTaxAmount,
      otherChargesBeforeTaxPercent,
      otherChargesBeforeTaxGstRate,
      otherChargesAfterTax,
      ...rest
    } = req.body;

    let processedItems = invoice.items;
    let totalTaxableValue = invoice.totalTaxableValue;
    let gstTotal = 0;

    if (items?.length) {
      const processed = await processItems(items);
      processedItems = processed.processedItems;
      totalTaxableValue = processed.totalTaxableValue;
      gstTotal = processed.gstTotal;
    }

    const beforeTaxPercentValue =
      (totalTaxableValue * (otherChargesBeforeTaxPercent || 0)) / 100;
    const beforeTaxFixedValue = otherChargesBeforeTaxAmount || 0;
    const beforeTaxTotal = beforeTaxFixedValue + beforeTaxPercentValue;
    const beforeTaxGst = (beforeTaxTotal * (otherChargesBeforeTaxGstRate || 0)) / 100;

    const totalInvoiceValue =
      totalTaxableValue + beforeTaxTotal + gstTotal + beforeTaxGst + (otherChargesAfterTax || 0);

    invoice.set({
      ...rest,
      items: processedItems,
      otherChargesBeforeTaxAmount: beforeTaxFixedValue,
      otherChargesBeforeTaxPercent: otherChargesBeforeTaxPercent || 0,
      otherChargesBeforeTaxGstRate: otherChargesBeforeTaxGstRate || 0,
      otherChargesAfterTax: otherChargesAfterTax || 0,
      totalTaxableValue: totalTaxableValue + beforeTaxTotal,
      totalInvoiceValue,
    });

    await invoice.save();
    res.status(200).json({ message: "Purchase Invoice Updated", invoice });
  } catch (error) {
    console.error("Error updating invoice:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.deletePurchaseInvoice = async (req, res) => {
  try {
    const deletedInvoice = await PurchaseInvoice.findByIdAndDelete(req.params.id);
    if (!deletedInvoice) return res.status(404).json({ error: "Invoice not found" });
    res.status(200).json({ message: "Purchase Invoice Deleted" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.getInvoiceReport = async (req, res) => {
  try {
    const { from, to, format, level } = req.query;
    const match = {};
    if (from && to) match.date = { $gte: new Date(from), $lte: new Date(to) };

    const invoices = await PurchaseInvoice.find(match)
      .sort({ date: 1 })
      .populate("vendor", "code name gstNumber")
      .populate("items.item", "_id code headDescription subDescription category hsnCode");

    const summary = {
      totalInvoices: invoices.length,
      totalTaxableValue: invoices.reduce((sum, inv) => sum + (inv.totalTaxableValue || 0), 0),
      totalInvoiceValue: invoices.reduce((sum, inv) => sum + (inv.totalInvoiceValue || 0), 0),
    };

    if (format === "excel") {
      let data;
      if (level === "item") {
        data = invoices.flatMap((inv) =>
          inv.items.map((it) => ({
            InvoiceNumber: inv.invoiceNumber,
            Date: inv.date.toISOString().split("T")[0],
            PartyName: inv.partyName,
            VendorName: inv.vendor?.name || "",
            ItemCode: it.item?.code || "",
            ItemHeadDescription: it.item?.headDescription || "",
            ItemSubDescription: it.item?.subDescription || "",
            HSN: it.hsnSnapshot || it.item?.hsnCode || "",
            Quantity: it.subQuantity,
            Rate: it.rate,
            Amount: it.amount,
            GST: it.gstRate,
          }))
        );
      } else {
        data = invoices.map((inv) => ({
          InvoiceNumber: inv.invoiceNumber,
          Date: inv.date.toISOString().split("T")[0],
          PartyName: inv.partyName,
          VendorCode: inv.vendor?.code || "",
          VendorName: inv.vendor?.name || "",
          TotalTaxableValue: inv.totalTaxableValue,
          TotalInvoiceValue: inv.totalInvoiceValue,
        }));
      }

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Invoices");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Disposition", "attachment; filename=InvoiceReport.xlsx");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      return res.send(buffer);
    }

    res.status(200).json({ summary, invoices });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.getItemHistoryFromInvoices = async (req, res) => {
  try {
    const { code } = req.params;
    const item = await Item.findOne({ code });
    if (!item) return res.status(404).json({ error: "Item not found" });

    const invoices = await PurchaseInvoice.find({ "items.item": item._id })
      .sort({ date: -1 })
      .populate("vendor", "code name gstNumber")
      .populate("items.item", "code headDescription subDescription category hsnCode");

    if (!invoices.length) return res.status(404).json({ error: "No history found" });

    const supplierHistory = invoices.flatMap((inv) =>
      inv.items
        .filter((it) => String(it.item?._id) === String(item._id))
        .map((it) => ({
          date: inv.date,
          invoiceNumber: inv.invoiceNumber,
          supplierName: inv.partyName,
          vendorCode: inv.vendor?.code || "",
          vendorName: inv.vendor?.name || "",
          description: it.overrideDescription,
          hsnCode: it.hsnSnapshot || it.item?.hsnCode || "",
          quantity: it.subQuantity,
          rate: it.rate,
          amount: it.amount,
          gstRate: it.gstRate,
        }))
    );

    let closingQty = 0;
    const stockHistory = supplierHistory
      .map((s) => {
        closingQty += s.quantity || 0;
        return { date: s.date, in: s.quantity || 0, out: 0, closingQty };
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      item: {
        code: item.code,
        headDescription: item.headDescription,
        subDescription: item.subDescription,
      },
      supplierHistory,
      stock: stockHistory,
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};
