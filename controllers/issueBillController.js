const IssueBill = require('../models/issueBill');
const Item = require('../models/item');

exports.createIssueBill = async (req, res) => {
  try {
    const { issueNo, issueDate, department, items, issuedBy } = req.body;

    if (!issueNo || !issueDate || !department || !items || items.length === 0) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    let totalAmount = 0;
    const processedItems = [];

    for (const it of items) {
      const dbItem = await Item.findById(it.item);
      if (!dbItem) {
        return res.status(400).json({ error: `Item with ID ${it.item} not found` });
      }

      if (dbItem.closingQty < it.quantity) {
        return res.status(400).json({ error: `Not enough stock for ${dbItem.name}` });
      }

      const amount = (it.rate || 0) * (it.quantity || 0);
      totalAmount += amount;

      dbItem.closingQty -= it.quantity;
      await dbItem.save();

      processedItems.push({
        item: it.item,
        quantity: it.quantity,
        rate: it.rate,
        amount
      });
    }

    const newIssueBill = new IssueBill({
      issueNo,
      issueDate,
      department,
      items: processedItems,
      totalAmount,
      issuedBy
    });

    await newIssueBill.save();
    res.status(201).json({ message: "Issue Bill Created Successfully", bill: newIssueBill });
  } catch (error) {
    console.error("Error creating issue bill:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getIssueBills = async (req, res) => {
  try {
    const bills = await IssueBill.find().populate("items.item");
    res.status(200).json(bills);
  } catch (error) {
    console.error("Error fetching issue bills:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getIssueBillById = async (req, res) => {
  try {
    const bill = await IssueBill.findById(req.params.id).populate("items.item");
    if (!bill) return res.status(404).json({ error: "Issue Bill not found" });
    res.status(200).json(bill);
  } catch (error) {
    console.error("Error fetching issue bill:", error);
    res.status(500).json({ error: "Server error" });
  }
};


exports.updateIssueBill = async (req, res) => {
  try {
    const updatedBill = await IssueBill.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedBill) return res.status(404).json({ error: "Issue Bill not found" });
    res.status(200).json({ message: "Issue Bill Updated", bill: updatedBill });
  } catch (error) {
    console.error("Error updating issue bill:", error);
    res.status(500).json({ error: "Server error" });
  }
};


exports.deleteIssueBill = async (req, res) => {
  try {
    const deletedBill = await IssueBill.findByIdAndDelete(req.params.id);
    if (!deletedBill) return res.status(404).json({ error: "Issue Bill not found" });
    res.status(200).json({ message: "Issue Bill Deleted" });
  } catch (error) {
    console.error("Error deleting issue bill:", error);
    res.status(500).json({ error: "Server error" });
  }
};
