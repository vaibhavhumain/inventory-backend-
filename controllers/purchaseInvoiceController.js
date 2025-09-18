const PurchaseInvoice = require('../models/purchaseInvoice');

exports.createPurchaseInvoice = async (req, res) => {
  try {
    const { invoiceNumber, date, partyName, items, otherChargesBeforeTax, otherChargesAfterTax } = req.body;

    if (!invoiceNumber || !partyName || !items || items.length === 0) {
      return res.status(400).json({ error: 'Invoice number, party name and at least one item are required' });
    }

    let totalTaxableValue = 0;
    const processedItems = [];
    let gstTotal = 0;

    for (const it of items) {
      const amount = (it.subQuantity || 0) * (it.rate || 0);
      totalTaxableValue += amount;

      if (it.gstRate) {
        gstTotal += (amount * it.gstRate) / 100;
      }

      processedItems.push({
        item: it.item,
        description: it.description,
        headQuantity: it.headQuantity,
        headQuantityMeasurement: it.headQuantityMeasurement,
        subQuantity: it.subQuantity,
        subQuantityMeasurement: it.subQuantityMeasurement,
        hsnCode: it.hsnCode,
        rate: it.rate,
        amount,
        gstRate: it.gstRate,
        notes: it.notes
      });
    }

    const totalInvoiceValue =
      totalTaxableValue +
      (otherChargesBeforeTax || 0) +
      gstTotal +
      (otherChargesAfterTax || 0);

    const newInvoice = new PurchaseInvoice({
      invoiceNumber,
      date: date || new Date(),
      partyName,
      items: processedItems,
      otherChargesBeforeTax: otherChargesBeforeTax || 0,
      otherChargesAfterTax: otherChargesAfterTax || 0,
      totalTaxableValue,
      totalInvoiceValue
    });

    await newInvoice.save();
    res.status(201).json({ message: 'Purchase Invoice Added Successfully', invoice: newInvoice });
  } catch (error) {
    console.error('Error adding purchase invoice:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get all invoices
exports.getPurchaseInvoices = async (req, res) => {
  try {
    const invoices = await PurchaseInvoice.find();
    res.status(200).json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get invoice by ID
exports.getPurchaseInvoiceById = async (req, res) => {
  try {
    const invoice = await PurchaseInvoice.findById(req.params.id);
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
    const updatedInvoice = await PurchaseInvoice.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedInvoice) return res.status(404).json({ error: 'Invoice not found' });
    res.status(200).json({ message: 'Purchase Invoice Updated', invoice: updatedInvoice });
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete invoice
exports.deletePurchaseInvoice = async (req, res) => {
  try {
    const deletedInvoice = await PurchaseInvoice.findByIdAndDelete(req.params.id);
    if (!deletedInvoice) return res.status(404).json({ error: 'Invoice not found' });
    res.status(200).json({ message: 'Purchase Invoice Deleted' });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
