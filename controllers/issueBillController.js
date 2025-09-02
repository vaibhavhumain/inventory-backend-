const IssueBill = require('../models/issueBill');
const Item = require('../models/item');

// ✅ Create Issue Bill
exports.createIssueBill = async (req, res) => {
  try {
    const { issueNo, issueDate, department, items, issuedBy } = req.body;

    // Validation
    if (!issueNo || !issueDate || !department || !items || items.length === 0) {
      return res.status(400).json({ error: "All fields are required" });
    }

    let totalAmount = 0;
    const processedItems = [];

    for (const it of items) {
      const dbItem = await Item.findById(it.item);
      if (!dbItem) {
        return res.status(400).json({ error: `Item with ID ${it.item} not found` });
      }

      // Check stock in Main Store
      if (dbItem.mainStoreQty < it.quantity) {
        return res.status(400).json({
          error: `Not enough stock in Main Store for ${dbItem.description}`,
        });
      }

      // Calculate amount
      const amount = (it.rate || 0) * (it.quantity || 0);
      totalAmount += amount;

      // Transfer stock (Main → Sub)
      dbItem.mainStoreQty = Math.max(0, dbItem.mainStoreQty - it.quantity);
      dbItem.subStoreQty = (dbItem.subStoreQty || 0) + it.quantity;

      // Recalculate closing qty
      dbItem.closingQty = dbItem.mainStoreQty + dbItem.subStoreQty;

      // Add to stock history
      dbItem.dailyStock.push({
        date: new Date(),
        in: 0,
        out: it.quantity,
        closingQty: dbItem.closingQty,
        mainStoreQty: dbItem.mainStoreQty,
        subStoreQty: dbItem.subStoreQty,
      });

      await dbItem.save();

      processedItems.push({
        item: it.item,
        quantity: it.quantity,
        rate: it.rate,
        amount,
      });
    }

    const newIssueBill = new IssueBill({
      issueNo,
      issueDate,
      department,
      items: processedItems,
      totalAmount,
      issuedBy,
    });

    await newIssueBill.save();

    res
      .status(201)
      .json({ message: "✅ Issue Bill Created Successfully", bill: newIssueBill });
  } catch (error) {
    console.error("Error creating issue bill:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// ✅ Get all issue bills
exports.getIssueBills = async (req, res) => {
  try {
    const bills = await IssueBill.find().populate("items.item");
    res.status(200).json(bills);
  } catch (error) {
    console.error("Error fetching issue bills:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// ✅ Get bill by ID
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

// ✅ Update bill (⚠️ doesn’t yet adjust stock, only updates doc)
exports.updateIssueBill = async (req, res) => {
  try {
    const { id } = req.params;
    const { items, department, issuedBy, issueDate } = req.body;

    const oldBill = await IssueBill.findById(id);
    if (!oldBill) return res.status(404).json({ error: "Issue Bill not found" });

    // 1. Reverse old stock
    for (const it of oldBill.items) {
      const dbItem = await Item.findById(it.item);
      if (!dbItem) continue;

      dbItem.mainStoreQty += it.quantity;
      dbItem.subStoreQty = Math.max(0, dbItem.subStoreQty - it.quantity);
      dbItem.closingQty = dbItem.mainStoreQty + dbItem.subStoreQty;

      dbItem.dailyStock.push({
        date: new Date(),
        in: it.quantity,
        out: 0,
        closingQty: dbItem.closingQty,
        mainStoreQty: dbItem.mainStoreQty,
        subStoreQty: dbItem.subStoreQty,
      });

      await dbItem.save();
    }

    // 2. Apply new stock (like create)
    let totalAmount = 0;
    const processedItems = [];
    for (const it of items) {
      const dbItem = await Item.findById(it.item);
      if (!dbItem) continue;

      if (dbItem.mainStoreQty < it.quantity) {
        return res.status(400).json({ error: `Not enough stock for ${dbItem.description}` });
      }

      const amount = (it.rate || 0) * (it.quantity || 0);
      totalAmount += amount;

      dbItem.mainStoreQty -= it.quantity;
      dbItem.subStoreQty += it.quantity;
      dbItem.closingQty = dbItem.mainStoreQty + dbItem.subStoreQty;

      dbItem.dailyStock.push({
        date: new Date(),
        in: 0,
        out: it.quantity,
        closingQty: dbItem.closingQty,
        mainStoreQty: dbItem.mainStoreQty,
        subStoreQty: dbItem.subStoreQty,
      });

      await dbItem.save();

      processedItems.push({
        item: it.item,
        quantity: it.quantity,
        rate: it.rate,
        amount,
      });
    }

    // 3. Save updated bill
    oldBill.items = processedItems;
    oldBill.department = department || oldBill.department;
    oldBill.issuedBy = issuedBy || oldBill.issuedBy;
    oldBill.issueDate = issueDate || oldBill.issueDate;
    oldBill.totalAmount = totalAmount;

    await oldBill.save();

    res.status(200).json({ message: "✅ Issue Bill Updated & Stock Synced", bill: oldBill });
  } catch (error) {
    console.error("Error updating issue bill:", error);
    res.status(500).json({ error: "Server error" });
  }
};


// ✅ Delete bill (reverses stock back)
exports.deleteIssueBill = async (req, res) => {
  try {
    const deletedBill = await IssueBill.findByIdAndDelete(req.params.id);
    if (!deletedBill) {
      return res.status(404).json({ error: "Issue Bill not found" });
    }

    // Reverse stock adjustments
    for (const it of deletedBill.items) {
      const dbItem = await Item.findById(it.item);
      if (!dbItem) continue;

      // Reverse transfer (Sub → Main)
      dbItem.mainStoreQty += it.quantity;
      dbItem.subStoreQty = Math.max(0, dbItem.subStoreQty - it.quantity);

      // Recalc closing qty
      dbItem.closingQty = dbItem.mainStoreQty + dbItem.subStoreQty;

      // Log reversal in history
      dbItem.dailyStock.push({
        date: new Date(),
        in: it.quantity,
        out: 0,
        closingQty: dbItem.closingQty,
        mainStoreQty: dbItem.mainStoreQty,
        subStoreQty: dbItem.subStoreQty,
      });

      await dbItem.save();
    }

    res.status(200).json({ message: "✅ Issue Bill Deleted & Stock Reversed" });
  } catch (error) {
    console.error("Error deleting issue bill:", error);
    res.status(500).json({ error: "Server error" });
  }
};
