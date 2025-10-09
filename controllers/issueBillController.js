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

    if (!department || !items || items.length === 0 || !type) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!["MAIN_TO_SUB", "SUB_TO_USER", "SUB_TO_SALE"].includes(type)) {
      return res.status(400).json({ error: "Invalid issue type" });
    }

    const userName = req.user?.name || "System";
    const userId = req.user?._id || null;

    let totalAmount = 0;
    const processedItems = [];

    for (const it of items) {
      const dbItem = await Item.findById(it.item);
      if (!dbItem) {
        return res.status(400).json({ error: `Item ${it.item} not found` });
      }

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

    let finalVoucherNumber = voucherNumber;
    if (!finalVoucherNumber) {
      const count = await IssueBill.countDocuments();
      finalVoucherNumber = `ISS-${String(count + 1).padStart(4, "0")}`;
    }

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

    if (type === "SUB_TO_USER" && bus?.busCode) {
      let existingBus = await Bus.findOne({ busCode: bus.busCode });

      if (existingBus) {
        existingBus.ownerName = bus.ownerName || existingBus.ownerName;
        existingBus.chassisNo = bus.chassisNo || existingBus.chassisNo;
        existingBus.engineNo = bus.engineNo || existingBus.engineNo;
        existingBus.model = bus.model || existingBus.model;

        if (!existingBus.issueBills.includes(newBill._id)) {
          existingBus.issueBills.push(newBill._id);
        }

        await existingBus.save();
        newBill.bus = existingBus._id;
      } else {
        const newBus = new Bus({
          busCode: bus.busCode,
          ownerName: bus.ownerName,
          chassisNo: bus.chassisNo,
          engineNo: bus.engineNo,
          model: bus.model,
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

exports.createMultiIssueBill = async (req, res) => {
  try {
    const {
      issueDate,
      voucherNumber,
      voucherDate,
      type,
      department,
      issuedTo,
      items,
    } = req.body;

    if (!type || !items || items.length === 0) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    if (type !== "SUB_TO_USER") {
      return res.status(400).json({
        error: "This endpoint is only for SUB_TO_USER issue type.",
      });
    }

    const userName = req.user?.name || "System";
    const userId = req.user?._id || null;

    // Group items by Bus
    const groupedByBus = {};
    items.forEach((it) => {
      if (!it.bus) return;
      if (!groupedByBus[it.bus]) groupedByBus[it.bus] = [];
      groupedByBus[it.bus].push(it);
    });

    const results = [];

    // For each bus, create a separate IssueBill
    for (const [busId, busItems] of Object.entries(groupedByBus)) {
      const bus = await Bus.findById(busId);
      if (!bus) continue;

      let totalAmount = 0;
      const processedItems = [];

      // 🔹 Process each item for that bus
      for (const it of busItems) {
        const dbItem = await Item.findById(it.item);
        if (!dbItem) continue;

        // Reduce sub store qty
        if (dbItem.subStoreQty < it.quantity) {
          return res.status(400).json({
            error: `Not enough stock in Sub Store for ${dbItem.headDescription}`,
          });
        }
        dbItem.subStoreQty -= it.quantity;
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

        const amount = (it.rate || 0) * (it.quantity || 0);
        totalAmount += amount;

        await InventoryTransaction.create({
          item: dbItem._id,
          type: "CONSUMPTION",
          quantity: it.quantity,
          rate: it.rate || 0,
          amount,
          date: issueDate || new Date(),
          meta: {
            note: `Issued by ${userName} to ${issuedTo}`,
            bus: bus.busCode,
          },
        });

        processedItems.push({
          item: dbItem._id,
          quantity: it.quantity,
          rate: it.rate,
          amount,
        });
      }

      // 🔹 Create IssueBill for each bus
      const count = await IssueBill.countDocuments();
      const finalVoucherNumber =
        voucherNumber || `ISS-${String(count + 1).padStart(4, "0")}`;

      const issueBill = new IssueBill({
        issueDate,
        voucherNumber: finalVoucherNumber,
        voucherDate,
        type,
        department,
        issuedTo,
        totalAmount,
        items: processedItems,
        bus: bus._id,
        issuedBy: { id: userId, name: userName },
      });

      await issueBill.save();

      // 🔹 Link to bus
      if (!bus.issueBills.includes(issueBill._id)) {
        bus.issueBills.push(issueBill._id);
        await bus.save();
      }

      results.push({
        busCode: bus.busCode,
        totalAmount,
        issueBillId: issueBill._id,
      });
    }

    return res.status(201).json({
      message: "✅ Multi-bus Issue Bills created successfully.",
      results,
    });
  } catch (err) {
    console.error("Error creating multi issue bills:", err);
    res.status(500).json({ error: err.message });
  }
};