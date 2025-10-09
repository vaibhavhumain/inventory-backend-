const Item = require("../models/item");
const Bus = require("../models/Bus");
const IssueBill = require("../models/issueBill");
const InventoryTransaction = require("../models/InventoryTransaction");

exports.createIssueBill = async (req, res) => {
  try {
    const {
      issueDate,
      department,
      items,
      type,
      issuedTo,
      bus,
      voucherNumber,
      voucherDate,
    } = req.body;

    // ✅ Basic validation
    if (!department || !items || items.length === 0 || !type) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!["MAIN_TO_SUB", "SUB_TO_USER", "SUB_TO_SALE"].includes(type)) {
      return res.status(400).json({ error: "Invalid issue type" });
    }

    // 🟢 Automatically get user's name & id
    const userName = req.user?.name || "System";
    const userId = req.user?._id || null;

    let totalAmount = 0;
    const processedItems = [];

    // 🔹 Process each item
    for (const it of items) {
      const dbItem = await Item.findById(it.item);
      if (!dbItem) {
        return res.status(400).json({ error: `Item ${it.item} not found` });
      }

      // 🔹 Stock adjustments
      if (type === "MAIN_TO_SUB") {
        if (dbItem.mainStoreQty < it.quantity) {
          return res.status(400).json({
            error: `Not enough stock in Main Store for ${dbItem.headDescription}`,
          });
        }
        dbItem.mainStoreQty -= it.quantity;
        dbItem.subStoreQty += it.quantity;
      } else if (["SUB_TO_USER", "SUB_TO_SALE"].includes(type)) {
        if (dbItem.subStoreQty < it.quantity) {
          return res.status(400).json({
            error: `Not enough stock in Sub Store for ${dbItem.headDescription}`,
          });
        }
        dbItem.subStoreQty -= it.quantity;
      }

      dbItem.closingQty = dbItem.mainStoreQty + dbItem.subStoreQty;

      dbItem.dailyStock.push({
        date: issueDate || new Date(),
        in: 0,
        out: it.quantity,
        closingQty: dbItem.closingQty,
        mainStoreQty: dbItem.mainStoreQty,
        subStoreQty: dbItem.subStoreQty,
      });

      await dbItem.save();

      // 🔹 Transaction type mapping
      let txnType = "ISSUE_TO_SUB";
      if (type === "SUB_TO_USER") txnType = "CONSUMPTION";
      if (type === "SUB_TO_SALE") txnType = "SALE";

      const lineAmount = (it.rate || 0) * (it.quantity || 0);
      totalAmount += lineAmount;

      await InventoryTransaction.create({
        item: dbItem._id,
        type: txnType,
        quantity: it.quantity,
        rate: it.rate || 0,
        amount: lineAmount,
        date: issueDate || new Date(),
        meta: {
          note: `Issued by ${userName} to ${issuedTo || department}`,
          customer: type === "SUB_TO_SALE" ? issuedTo : undefined,
        },
      });

      processedItems.push({
        item: it.item,
        quantity: it.quantity,
        rate: it.rate || 0,
        amount: lineAmount,
      });
    }

    // ✅ Auto-generate voucher number if not provided
    let finalVoucherNumber = voucherNumber;
    if (!finalVoucherNumber) {
      const count = await IssueBill.countDocuments();
      finalVoucherNumber = `ISS-${String(count + 1).padStart(4, "0")}`;
    }

    // ✅ Create new IssueBill
    const newBill = new IssueBill({
      issueDate,
      department,
      type,
      issuedTo: ["SUB_TO_USER", "SUB_TO_SALE"].includes(type)
        ? issuedTo
        : undefined,
      items: processedItems,
      totalAmount,
      voucherNumber: finalVoucherNumber,
      voucherDate: voucherDate || new Date(),
      issuedBy: {
        id: userId,
        name: userName,
      },
    });

    await newBill.save();

    // ✅ Attach IssueBill to Bus (new structure)
    if (type === "SUB_TO_USER" && bus?.busCode) {
      let existingBus = await Bus.findOne({ busCode: bus.busCode });

      if (existingBus) {
        if (!existingBus.issueBills.includes(newBill._id)) {
          existingBus.issueBills.push(newBill._id);
          await existingBus.save();
        }
        newBill.bus = existingBus._id;
      } else {
        const newBus = new Bus({
          busCode: bus.busCode,
          issueBills: [newBill._id],
        });
        await newBus.save();
        newBill.bus = newBus._id;
      }

      await newBill.save();
    }

    res.status(201).json({
      message: "✅ Issue Bill Created Successfully",
      bill: newBill,
    });
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
