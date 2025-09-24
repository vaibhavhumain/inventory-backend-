const IssueBill = require("../models/issueBill");
const Item = require("../models/item");
const InventoryTransaction = require("../models/InventoryTransaction");
const Bus = require("../models/Bus");

// ✅ Create Issue Bill
exports.createIssueBill = async (req, res) => {
  try {
    const { issueDate, department, items, issuedBy, type, issuedTo, bus } = req.body;

    if (!department || !items || items.length === 0 || !type) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // ✅ Validate type
    if (!["MAIN_TO_SUB", "SUB_TO_USER", "SUB_TO_SALE"].includes(type)) {
      return res.status(400).json({ error: "Invalid issue type" });
    }

    let totalAmount = 0;
    const processedItems = [];

    // ✅ Process each item
    for (const it of items) {
      const dbItem = await Item.findById(it.item);
      if (!dbItem) {
        return res.status(400).json({ error: `Item ${it.item} not found` });
      }

      // ✅ Stock validation + movement
      if (type === "MAIN_TO_SUB") {
        if (dbItem.mainStoreQty < it.quantity) {
          return res
            .status(400)
            .json({ error: `Not enough stock in Main Store for ${dbItem.name}` });
        }
        dbItem.mainStoreQty -= it.quantity;
        dbItem.subStoreQty += it.quantity;
      } else if (type === "SUB_TO_USER" || type === "SUB_TO_SALE") {
        if (dbItem.subStoreQty < it.quantity) {
          return res
            .status(400)
            .json({ error: `Not enough stock in Sub Store for ${dbItem.name}` });
        }
        dbItem.subStoreQty -= it.quantity;
      }

      // ✅ Closing qty
      const closingQty = dbItem.mainStoreQty + dbItem.subStoreQty;
      dbItem.closingQty = closingQty;

      dbItem.dailyStock.push({
        date: new Date(),
        in: 0,
        out: it.quantity,
        closingQty,
        mainStoreQty: dbItem.mainStoreQty,
        subStoreQty: dbItem.subStoreQty,
      });

      await dbItem.save();

      // ✅ Log Inventory Transaction
      await InventoryTransaction.create({
        item: dbItem._id,
        type:
          type === "MAIN_TO_SUB"
            ? "ISSUE_TO_SUB"
            : type === "SUB_TO_USER"
            ? "CONSUMPTION"
            : "SALE",
        quantity: it.quantity,
        date: issueDate || new Date(),
        meta: {
          note: `Issued by ${issuedBy || "N/A"} to ${issuedTo || department}`,
          customer: type === "SUB_TO_SALE" ? issuedTo : undefined,
        },
      });

      // ✅ Amount
      const amount = (it.rate || 0) * (it.quantity || 0);
      totalAmount += amount;

      processedItems.push({
        item: it.item,
        quantity: it.quantity,
        rate: it.rate || 0,
        amount,
      });
    }

    // ✅ Create Issue Bill
    const newBill = new IssueBill({
      issueDate,
      department,
      type,
      issuedTo: ["SUB_TO_USER", "SUB_TO_SALE"].includes(type) ? issuedTo : undefined,
      items: processedItems,
      totalAmount,
      issuedBy,
    });

    await newBill.save();

    // ✅ If SUB_TO_USER → also create a Bus record
    if (type === "SUB_TO_USER" && bus) {
      const newBus = new Bus({
        chassisNumber: bus.chassisNumber,
        engineNumber: bus.engineNumber,
        model: bus.model,
        remarks: bus.remarks,
        issueBill: newBill._id,
      });

      await newBus.save();

      // Link bus to IssueBill
      newBill.bus = newBus._id;
      await newBill.save();
    }

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
    if (type) query.type = type;

    const bills = await IssueBill.find(query)
      .populate("items.item")
      .populate("bus");
    res.status(200).json(bills);
  } catch (error) {
    console.error("Error fetching issue bills:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// ✅ Get bill by ID
exports.getIssueBillById = async (req, res) => {
  try {
    const bill = await IssueBill.findById(req.params.id)
      .populate("items.item")
      .populate("bus");

    if (!bill) {
      return res.status(404).json({ error: "Issue Bill not found" });
    }
    res.status(200).json(bill);
  } catch (error) {
    console.error("Error fetching bill by ID:", error);
    res.status(500).json({ error: "Server error" });
  }
};
