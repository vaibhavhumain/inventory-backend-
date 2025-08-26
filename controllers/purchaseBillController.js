const PurchaseBill = require('../models/purchaseBill');
const Item = require('../models/item');

exports.createPurchaseBill = async (req, res) => {
  try {
    const { billNo, billDate, supplierName, items } = req.body;

    if (!billNo || !billDate || !supplierName || !items || items.length === 0) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    let totalAmount = 0;
    const processedItems = [];

    for (const it of items) {
      const dbItem = await Item.findById(it.item);
      if (!dbItem) {
        return res.status(400).json({ error: `Item with ID ${it.item} not found` });
      }

      const amount = (it.rate || 0) * (it.quantity || 0);
      totalAmount += amount;

      dbItem.closingQty += it.quantity;
      await dbItem.save();

      processedItems.push({
        item: it.item,
        quantity: it.quantity,
        rate: it.rate,
        amount
      });
    }

    const newBill = new PurchaseBill({
      billNo,
      billDate,
      supplierName,
      items: processedItems,
      totalAmount
    });

    await newBill.save();
    res.status(201).json({ message: "Purchase Bill Added Successfully", bill: newBill });
  } catch (error) {
    console.error('Error adding purchase bill:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getPurchaseBills = async (req, res) => {
  try {
    const bills = await PurchaseBill.find().populate("items.item");
    res.status(200).json(bills);
  } catch (error) {
    console.error('Error fetching bills:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getPurchaseBillById = async (req, res) => {
  try {
    const bill = await PurchaseBill.findById(req.params.id).populate("items.item");
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    res.status(200).json(bill);
  } catch (error) {
    console.error('Error fetching bill:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updatePurchaseBill = async (req, res) => {
  try {
    const updatedBill = await PurchaseBill.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedBill) return res.status(404).json({ error: 'Bill not found' });
    res.status(200).json({ message: 'Purchase Bill Updated', bill: updatedBill });
  } catch (error) {
    console.error('Error updating bill:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deletePurchaseBill = async (req, res) => {
  try {
    const deletedBill = await PurchaseBill.findByIdAndDelete(req.params.id);
    if (!deletedBill) return res.status(404).json({ error: 'Bill not found' });
    res.status(200).json({ message: 'Purchase Bill Deleted' });
  } catch (error) {
    console.error('Error deleting bill:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
