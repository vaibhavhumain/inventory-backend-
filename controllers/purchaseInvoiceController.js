const mongoose = require("mongoose");
const Category = require("../models/Category");
const PurchaseInvoice = require("../models/purchaseInvoice");
const Item = require("../models/item");
const InventoryTransaction = require("../models/InventoryTransaction");
const XLSX = require("xlsx");

async function resolveCategoryId({ category, categoryLabel, prefix, allowCreate = true }) {
  if (category && mongoose.Types.ObjectId.isValid(category)) return category;

  if (category && typeof category === "string") {
    const q = category.trim();
    let cat =
      (await Category.findOne({ prefix: q.toUpperCase() })) ||
      (await Category.findOne({ name: q.toLowerCase() })) ||
      (await Category.findOne({ label: q }));
    if (cat) return cat._id;
  }

  if (categoryLabel && typeof categoryLabel === "string") {
    const name = categoryLabel.trim().toLowerCase();
    let cat = await Category.findOne({ name });
    if (!cat && allowCreate) {
      cat = await Category.create({
        name,
        label: categoryLabel.trim(),
        prefix: (prefix || name.replace(/[^a-z]/g, "").slice(0, 3) || "CAT").toUpperCase(),
      });
    }
    if (cat) return cat._id;
  }

  if (prefix && typeof prefix === "string") {
    const cat = await Category.findOne({ prefix: prefix.trim().toUpperCase() });
    if (cat) return cat._id;
  }

  let def = await Category.findOne({ name: "raw material" });
  if (!def) {
    def = await Category.create({ name: "raw material", label: "Raw Material", prefix: "RM" });
  }
  return def._id;
}

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

// ✅ Generate auto item code
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
    const headDescription = (it.headDescription || it.overrideDescription || "").trim();
    if (!headDescription) throw new Error("Head Description is required");

    const subQty = Number(it.subQuantity) || 0;
    const rate = Number(it.rate) || 0;
    const amount = subQty * rate;
    totalTaxableValue += amount;

    // Resolve Category as ObjectId (matches Item schema)
    const categoryId = await resolveCategoryId({
      category: it.category,
      categoryLabel: it.categoryLabel,
      prefix: it.prefix,
      allowCreate: true,
    });
    if (!categoryId) throw new Error("Valid category is required for item lines");

    // Find/create Item WITHOUT touching stock/dailyStock
    let existingItem = await Item.findOne({ headDescription, category: categoryId });
    if (!existingItem) {
      existingItem = new Item({
        // let Item pre-save hook generate 'code'
        category: categoryId,
        headDescription,
        subDescription: it.subDescription || "",
        unit: it.subQuantityMeasurement || "pcs",
        hsnCode: it.hsnCode || "",
        gstRate: Number(it.gstRate) || 0,
        remarks: it.notes || null,
      });
      await existingItem.save();
    }

    const gstRate = Number(existingItem.gstRate) || 0;
    gstTotal += (amount * gstRate) / 100;

    processedItems.push({
      item: existingItem._id,
      overrideDescription: it.overrideDescription || headDescription,
      headQuantity: Number(it.headQuantity) || 0,
      headQuantityMeasurement: it.headQuantityMeasurement || existingItem.unit || "pcs",
      subQuantity: subQty,
      subQuantityMeasurement: it.subQuantityMeasurement || existingItem.unit || "pcs",
      rate,
      amount,
      hsnSnapshot: existingItem.hsnCode || "",
      gstSnapshot: gstRate,
      notes: it.notes,
    });
  }

  return { processedItems, totalTaxableValue, gstTotal };
}


// ✅ Create Purchase Invoice
exports.createPurchaseInvoice = async (req, res) => {
  const session = await PurchaseInvoice.startSession();
  session.startTransaction();

  try {
    const {
      invoiceNumber,
      date,
      manualInvoiceDate,
      partyName,
      vendor,
      items,
      otherChargesBeforeTaxAmount,
      otherChargesBeforeTaxPercent,
      otherChargesBeforeTaxGstRate,
      otherChargesAfterTax,
    } = req.body;

    const parsed = date ? new Date(date) : null;
    const txDate = parsed && !isNaN(parsed.getTime()) ? parsed : new Date();

    if (!invoiceNumber || !partyName || !vendor || !items?.length) {
      return res.status(400).json({
        error: "Invoice number, vendor, party name and items are required",
      });
    }

    const { processedItems, totalTaxableValue, gstTotal } = await processItems(items);

    const beforeTaxPercentValue =
      (totalTaxableValue * (Number(otherChargesBeforeTaxPercent) || 0)) / 100;
    const beforeTaxFixedValue = Number(otherChargesBeforeTaxAmount) || 0;
    const beforeTaxTotal = beforeTaxFixedValue + beforeTaxPercentValue;
    const beforeTaxGst =
      (beforeTaxTotal * (Number(otherChargesBeforeTaxGstRate) || 0)) / 100;

    const totalInvoiceValue =
      totalTaxableValue +
      beforeTaxTotal +
      gstTotal +
      beforeTaxGst +
      (Number(otherChargesAfterTax) || 0);

    const newInvoice = new PurchaseInvoice({
      invoiceNumber,
      date: date || new Date(),
      manualInvoiceDate: manualInvoiceDate || null,
      vendor,
      partyName,
      items: processedItems,
      otherChargesBeforeTaxAmount: beforeTaxFixedValue,
      otherChargesBeforeTaxPercent: Number(otherChargesBeforeTaxPercent) || 0,
      otherChargesBeforeTaxGstRate: Number(otherChargesBeforeTaxGstRate) || 0,
      otherChargesAfterTax: Number(otherChargesAfterTax) || 0,
      totalTaxableValue: totalTaxableValue + beforeTaxTotal,
      totalInvoiceValue,
    });

    await newInvoice.save({ session });

    // ✅ Add Inventory Transactions
    for (const it of processedItems) {
      const lineAmount = (Number(it.subQuantity) || 0) * (Number(it.rate) || 0);
      await InventoryTransaction.create(
        [
          {
            item: it.item,
            type: "PURCHASE",
            quantity: Number(it.subQuantity) || 0,
            rate: Number(it.rate) || 0,
            amount: lineAmount,
            date: txDate ,
            meta: { invoice: newInvoice._id },
          },
        ],
        { session }
      );
    }

    await session.commitTransaction();
    res.status(201).json({ message: "Purchase Invoice Added", invoice: newInvoice });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error adding purchase invoice:", error);
    res.status(500).json({ error: error.message });
  } finally {
    session.endSession();
  }
};


// ✅ Get All Invoices
exports.getPurchaseInvoices = async (req, res) => {
  try {
    const invoices = await PurchaseInvoice.find()
      .populate("vendor", "code name gstNumber")
      .populate("items.item", "_id code headDescription subDescription category hsnCode gstRate");
    res.status(200).json(invoices);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// ✅ Get Invoice By ID
exports.getPurchaseInvoiceById = async (req, res) => {
  try {
    const invoice = await PurchaseInvoice.findById(req.params.id)
      .populate("vendor", "code name gstNumber")
      .populate("items.item", "_id code headDescription subDescription category hsnCode gstRate");
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.status(200).json(invoice);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// ✅ Update Invoice
exports.updatePurchaseInvoice = async (req, res) => {
  const session = await PurchaseInvoice.startSession();
  session.startTransaction();

  try {
    const invoice = await PurchaseInvoice.findById(req.params.id).session(session);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const {
      items,
      manualInvoiceDate,
      otherChargesBeforeTaxAmount,
      otherChargesBeforeTaxPercent,
      otherChargesBeforeTaxGstRate,
      otherChargesAfterTax,
      ...rest
    } = req.body;

   

    // 🧮 Reprocess new items
    const { processedItems, totalTaxableValue, gstTotal } = await processItems(items);

    const beforeTaxPercentValue =
      (totalTaxableValue * (Number(otherChargesBeforeTaxPercent) || 0)) / 100;
    const beforeTaxFixedValue = Number(otherChargesBeforeTaxAmount) || 0;
    const beforeTaxTotal = beforeTaxFixedValue + beforeTaxPercentValue;
    const beforeTaxGst =
      (beforeTaxTotal * (Number(otherChargesBeforeTaxGstRate) || 0)) / 100;

    const totalInvoiceValue =
      totalTaxableValue +
      beforeTaxTotal +
      gstTotal +
      beforeTaxGst +
      (Number(otherChargesAfterTax) || 0);

    // 🆕 Update Invoice
    invoice.set({
      ...rest,
      manualInvoiceDate: manualInvoiceDate || invoice.manualInvoiceDate,
      items: processedItems,
      otherChargesBeforeTaxAmount: beforeTaxFixedValue,
      otherChargesBeforeTaxPercent: Number(otherChargesBeforeTaxPercent) || 0,
      otherChargesBeforeTaxGstRate: Number(otherChargesBeforeTaxGstRate) || 0,
      otherChargesAfterTax: Number(otherChargesAfterTax) || 0,
      totalTaxableValue: totalTaxableValue + beforeTaxTotal,
      totalInvoiceValue,
    });

    await invoice.save({ session });

    // 🧾 Refresh inventory transactions
    await InventoryTransaction.deleteMany({ 'meta.invoice': invoice._id }).session(session);
    for (const it of processedItems) {
      const lineAmount = (Number(it.subQuantity) || 0) * (Number(it.rate) || 0);
      await InventoryTransaction.create(
        [
          {
            item: it.item,
            type: "PURCHASE",
            quantity: Number(it.subQuantity) || 0,
            rate: Number(it.rate) || 0,
            amount: lineAmount,
            date: new Date(invoice.date),
            meta: { invoice: invoice._id },
          },
        ],
        { session }
      );
    }

    await session.commitTransaction();
    res.status(200).json({ message: "Purchase Invoice Updated", invoice });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error updating invoice:", error);
    res.status(500).json({ error: error.message });
  } finally {
    session.endSession();
  }
};


// ✅ Delete Invoice
exports.deletePurchaseInvoice = async (req, res) => {
  try {
    const deletedInvoice = await PurchaseInvoice.findByIdAndDelete(req.params.id);
    if (!deletedInvoice) return res.status(404).json({ error: "Invoice not found" });
    res.status(200).json({ message: "Purchase Invoice Deleted" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// ✅ Generate Excel / Summary Report
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
            SystemDate: inv.date ? inv.date.toISOString().split("T")[0] : "",
            ManualInvoiceDate: inv.manualInvoiceDate
              ? inv.manualInvoiceDate.toISOString().split("T")[0]
              : "",
            PartyName: inv.partyName,
            VendorName: inv.vendor?.name || "",
            ItemCode: it.item?.code || "",
            ItemHeadDescription: it.item?.headDescription || "",
            ItemSubDescription: it.item?.subDescription || "",
            HSN: it.hsnSnapshot || it.item?.hsnCode || "",
            GST: it.gstSnapshot || it.item?.gstRate || 0,
            Quantity: it.subQuantity,
            Rate: it.rate,
            Amount: it.amount,
          }))
        );
      } else {
        data = invoices.map((inv) => ({
          InvoiceNumber: inv.invoiceNumber,
          SystemDate: inv.date ? inv.date.toISOString().split("T")[0] : "",
          ManualInvoiceDate: inv.manualInvoiceDate
            ? inv.manualInvoiceDate.toISOString().split("T")[0]
            : "",
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
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      return res.send(buffer);
    }

    res.status(200).json({ summary, invoices });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// ✅ Get Item Purchase History
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
          gstRate: it.gstSnapshot || it.item?.gstRate || 0,
        }))
    );

    res.json({
      item: {
        code: item.code,
        headDescription: item.headDescription,
        subDescription: item.subDescription,
      },
      supplierHistory,
    });
  } catch (error) {
    console.error("Error fetching item history:", error);
    res.status(500).json({ error: "Server error" });
  }
};
