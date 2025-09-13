const IssueBill = require('../models/issueBill');
const Item = require('../models/item');

// ✅ Create Issue Bill
exports.createIssueBill = async (req, res) => {
  try {
    const { issueNo, issueDate, department, items, issuedBy, type, issuedTo } = req.body;

    if (!issueNo || !department || !items || items.length === 0 || !type) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!['MAIN_TO_SUB', 'SUB_TO_USER'].includes(type)) {
      return res.status(400).json({ error: "Invalid issue type" });
    }

    let totalAmount = 0;
    const processedItems = [];

    for (const it of items) {
      const dbItem = await Item.findById(it.item);
      if (!dbItem) return res.status(400).json({ error: `Item ${it.item} not found` });

      if (type === 'MAIN_TO_SUB') {
        // 🔹 Transfer from Main → Sub
        if (dbItem.mainStoreQty < it.quantity) {
          return res.status(400).json({ error: `Not enough stock in Main Store for ${dbItem.description}` });
        }
        dbItem.mainStoreQty -= it.quantity;
        dbItem.subStoreQty += it.quantity;
      } 
      else if (type === 'SUB_TO_USER') {
        // 🔹 Issue from Sub → User
        if (dbItem.subStoreQty < it.quantity) {
          return res.status(400).json({ error: `Not enough stock in Sub Store for ${dbItem.description}` });
        }
        dbItem.subStoreQty -= it.quantity;
      }

      dbItem.closingQty = dbItem.mainStoreQty + dbItem.subStoreQty;

      // Log transaction
      dbItem.dailyStock.push({
        date: new Date(),
        in: 0,
        out: it.quantity,
        closingQty: dbItem.closingQty,
        mainStoreQty: dbItem.mainStoreQty,
        subStoreQty: dbItem.subStoreQty,
      });

      await dbItem.save();

      const amount = (it.rate || 0) * (it.quantity || 0);
      totalAmount += amount;

      processedItems.push({
        item: it.item,
        quantity: it.quantity,
        rate: it.rate || 0,
        amount
      });
    }

    const newBill = new IssueBill({
      issueNo,
      issueDate,
      department,
      type,
      issuedTo: type === 'SUB_TO_USER' ? issuedTo : undefined,
      items: processedItems,
      totalAmount,
      issuedBy
    });

    await newBill.save();

    res.status(201).json({ message: "✅ Issue Bill Created", bill: newBill });
  } catch (error) {
    console.error("Error creating issue bill:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// ✅ Get all issue bills
exports.getIssueBills = async (req, res) => {
  try {
    const { itemCode, type } = req.query;

    let query = {};
    if (itemCode) {
      const item = await Item.findOne({ code: itemCode });
      if (item) {
        query["items.item"] = item._id;
      }
    }
    if (type) {
      query.type = type;
    }

    const bills = await IssueBill.find(query).populate("items.item");
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
    res.status(500).json({ error: "Server error" });
  }
};

// ✅ Update Issue Bill (reverses old stock first)
exports.updateIssueBill = async (req, res) => {
  try {
    const { id } = req.params;
    const { items, department, issuedBy, issueDate, type, issuedTo } = req.body;

    const oldBill = await IssueBill.findById(id);
    if (!oldBill) return res.status(404).json({ error: "Issue Bill not found" });

    // 🔹 Reverse stock for old items
    for (const it of oldBill.items) {
      const dbItem = await Item.findById(it.item);
      if (!dbItem) continue;

      if (oldBill.type === 'MAIN_TO_SUB') {
        dbItem.mainStoreQty += it.quantity;
        dbItem.subStoreQty = Math.max(0, dbItem.subStoreQty - it.quantity);
      } 
      else if (oldBill.type === 'SUB_TO_USER') {
        dbItem.subStoreQty += it.quantity;
      }

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

    // 🔹 Apply new items
    let totalAmount = 0;
    const processedItems = [];

    for (const it of items) {
      const dbItem = await Item.findById(it.item);
      if (!dbItem) continue;

      if (type === 'MAIN_TO_SUB') {
        if (dbItem.mainStoreQty < it.quantity) {
          return res.status(400).json({ error: `Not enough stock in Main Store for ${dbItem.description}` });
        }
        dbItem.mainStoreQty -= it.quantity;
        dbItem.subStoreQty += it.quantity;
      } 
      else if (type === 'SUB_TO_USER') {
        if (dbItem.subStoreQty < it.quantity) {
          return res.status(400).json({ error: `Not enough stock in Sub Store for ${dbItem.description}` });
        }
        dbItem.subStoreQty -= it.quantity;
      }

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

      const amount = (it.rate || 0) * (it.quantity || 0);
      totalAmount += amount;

      processedItems.push({
        item: it.item,
        quantity: it.quantity,
        rate: it.rate || 0,
        amount
      });
    }

    // 🔹 Save updated bill
    oldBill.items = processedItems;
    oldBill.department = department || oldBill.department;
    oldBill.issuedBy = issuedBy || oldBill.issuedBy;
    oldBill.issueDate = issueDate || oldBill.issueDate;
    oldBill.type = type || oldBill.type;
    oldBill.issuedTo = type === 'SUB_TO_USER' ? issuedTo : undefined;
    oldBill.totalAmount = totalAmount;

    await oldBill.save();

    res.status(200).json({ message: "✅ Issue Bill Updated", bill: oldBill });
  } catch (error) {
    console.error("Error updating issue bill:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// ✅ Delete bill (reverse stock)
exports.deleteIssueBill = async (req, res) => {
  try {
    const deletedBill = await IssueBill.findByIdAndDelete(req.params.id);
    if (!deletedBill) return res.status(404).json({ error: "Issue Bill not found" });

    for (const it of deletedBill.items) {
      const dbItem = await Item.findById(it.item);
      if (!dbItem) continue;

      if (deletedBill.type === 'MAIN_TO_SUB') {
        dbItem.mainStoreQty += it.quantity;
        dbItem.subStoreQty = Math.max(0, dbItem.subStoreQty - it.quantity);
      } 
      else if (deletedBill.type === 'SUB_TO_USER') {
        dbItem.subStoreQty += it.quantity;
      }

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

    res.status(200).json({ message: "✅ Issue Bill Deleted & Stock Reversed" });
  } catch (error) {
    console.error("Error deleting issue bill:", error);
    res.status(500).json({ error: "Server error" });
  }
};
