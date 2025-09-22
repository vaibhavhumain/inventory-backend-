const PurchaseInvoice = require('../models/purchaseInvoice');
const Item = require('../models/item');
const XLSX = require('xlsx');

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

  console.log("🔹 generateItemCode");
  console.log("   safeCategory:", safeCategory);
  console.log("   prefix:", prefix);
  console.log("   lastItem:", lastItem?.code);

  let newCode;
  if (!lastItem) {
    newCode = `${prefix}0001`;
  } else {
    const match = lastItem.code?.match(/(\d+)$/);
    const lastNum = match ? parseInt(match[1], 10) : 0;
    newCode = `${prefix}${String(lastNum + 1).padStart(4, "0")}`;
  }

  console.log("   -> newCode:", newCode);
  return newCode;
}



// Create purchase invoice
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
      return res.status(400).json({
        error: "Invoice number, vendor, party name and at least one item are required",
      });
    }

    let totalTaxableValue = 0;
    const processedItems = [];
    let gstTotal = 0;


for (const it of items) {
  const itemName = it.name || it.item || it.description;
  if (!itemName) {
    return res.status(400).json({ error: "Item name is required for new items" });
  }

  let existingItem = await Item.findOne({ name: itemName });
  if (!existingItem) {
    const code = await generateItemCode(it.category || "raw material");

    existingItem = new Item({
      code,
      name: itemName,   // ✅ always saved as name
      category: it.category || "raw material",
      description: it.description,
      unit: it.subQuantityMeasurement,
      hsnCode: it.hsnCode,
      closingQty: it.subQuantity,
      mainStoreQty: it.subQuantity,
      dailyStock: [{
        date: new Date(),
        in: it.subQuantity,
        out: 0,
        closingQty: it.subQuantity,
        mainStoreQty: it.subQuantity,
        subStoreQty: 0
      }]
    });
    await existingItem.save();
  }
 else {
        // 🔹 update stock for existing item
        existingItem.closingQty += (it.subQuantity || 0);
        existingItem.mainStoreQty += (it.subQuantity || 0);

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

      // 🔹 Push invoice item with Item._id
      processedItems.push({
        item: existingItem._id,
        description: it.description,
        headQuantity: it.headQuantity,
        headQuantityMeasurement: it.headQuantityMeasurement,
        subQuantity: it.subQuantity,
        subQuantityMeasurement: it.subQuantityMeasurement,
        hsnCode: it.hsnCode,
        rate: it.rate,
        amount,
        gstRate: it.gstRate,
        notes: it.notes,
      });
    }

    // before-tax & totals
    const beforeTaxPercentValue = (totalTaxableValue * (otherChargesBeforeTaxPercent || 0)) / 100;
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
    res.status(201).json({
      message: "Purchase Invoice Added Successfully",
      invoice: newInvoice,
    });
  } catch (error) {
    console.error("Error adding purchase invoice:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get all invoices
exports.getPurchaseInvoices = async (req, res) => {
  try {
    const invoices = await PurchaseInvoice.find()
      .populate('vendor', 'code name gstNumber'); 
    res.status(200).json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get invoice by ID
exports.getPurchaseInvoiceById = async (req, res) => {
  try {
    const invoice = await PurchaseInvoice.findById(req.params.id)
      .populate('vendor', 'code name gstNumber');
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.status(200).json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update invoice
exports.updatePurchaseInvoice = async (req, res) => {
  try {
    const updatedInvoice = await PurchaseInvoice.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate('vendor', 'code name gstNumber');

    if (!updatedInvoice)
      return res.status(404).json({ error: 'Invoice not found' });

    res.status(200).json({
      message: 'Purchase Invoice Updated',
      invoice: updatedInvoice,
    });
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete invoice
exports.deletePurchaseInvoice = async (req, res) => {
  try {
    const deletedInvoice = await PurchaseInvoice.findByIdAndDelete(
      req.params.id
    );
    if (!deletedInvoice)
      return res.status(404).json({ error: 'Invoice not found' });
    res.status(200).json({ message: 'Purchase Invoice Deleted' });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Generate report (JSON or Excel)
exports.getInvoiceReport = async (req, res) => {
  try {
    const { from, to, format } = req.query;

    const match = {};
    if (from && to) {
      match.date = { $gte: new Date(from), $lte: new Date(to) };
    }

    const invoices = await PurchaseInvoice.find(match)
      .sort({ date: 1 })
      .populate('vendor', 'code name gstNumber');

    const summary = {
      totalInvoices: invoices.length,
      totalTaxableValue: invoices.reduce(
        (sum, inv) => sum + (inv.totalTaxableValue || 0),
        0
      ),
      totalInvoiceValue: invoices.reduce(
        (sum, inv) => sum + (inv.totalInvoiceValue || 0),
        0
      ),
    };

    if (format === 'excel') {
      const data = invoices.map((inv) => ({
        InvoiceNumber: inv.invoiceNumber,
        Date: inv.date.toISOString().split('T')[0],
        PartyName: inv.partyName,
        VendorCode: inv.vendor?.code || '',
        VendorName: inv.vendor?.name || '',
        TotalTaxableValue: inv.totalTaxableValue,
        TotalInvoiceValue: inv.totalInvoiceValue,
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader(
        'Content-Disposition',
        'attachment; filename=InvoiceReport.xlsx'
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      return res.send(buffer);
    }

    res.status(200).json({ summary, invoices });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get item history (from purchase invoices)
exports.getItemHistoryFromInvoices = async (req, res) => {
  try {
    const { code } = req.params;

    // 🔹 Find the Item by code
    const item = await Item.findOne({ code });
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    // 🔹 Now use item._id to search invoices
    const invoices = await PurchaseInvoice.find({ 'items.item': item._id })
      .sort({ date: -1 })
      .populate('vendor', 'code name gstNumber')
      .populate('items.item', 'code name category'); // optional: populate item info

    if (!invoices.length) {
      return res.status(404).json({ error: "No history found for this item" });
    }

    const supplierHistory = invoices.flatMap((inv) =>
      inv.items
        .filter((it) => String(it.item._id) === String(item._id))
        .map((it) => ({
          date: inv.date,
          invoiceNumber: inv.invoiceNumber,
          supplierName: inv.partyName,
          vendorCode: inv.vendor?.code || '',
          vendorName: inv.vendor?.name || '',
          description: it.description,
          hsnCode: it.hsnCode,
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
        return {
          date: s.date,
          in: s.quantity || 0,
          out: 0,
          closingQty,
        };
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      item: { code: item.code, name: item.name },
      supplierHistory,
      stock: stockHistory,
    });
  } catch (error) {
    console.error("Error fetching item history:", error);
    res.status(500).json({ error: "Server error" });
  }
};
