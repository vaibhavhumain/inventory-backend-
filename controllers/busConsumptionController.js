const Bus = require("../models/Bus");
const IssueBill = require("../models/issueBill");

// ✅ Create or update bus consumption (SUB_TO_USER only)
exports.createBusConsumption = async (req, res) => {
  try {
    const { busCode, issueBillId } = req.body;

    // 🔹 1. Validate required fields
    if (!busCode || !issueBillId) {
      return res.status(400).json({ error: "Bus Code and Issue Bill ID are required." });
    }

    // 🔹 2. Fetch Issue Bill
    const issueBill = await IssueBill.findById(issueBillId);
    if (!issueBill) {
      return res.status(404).json({ error: "IssueBill not found." });
    }

    // 🔹 3. Validate type (only SUB_TO_USER)
    if (issueBill.type !== "SUB_TO_USER") {
      return res.status(400).json({
        error: "Bus consumption allowed only for SUB_TO_USER issue bills.",
      });
    }

    // 🔹 4. Check if Bus already exists
    let bus = await Bus.findOne({ busCode });

    if (bus) {
      // ✅ If bus exists, link issue bill if not already linked
      if (!bus.issueBills.includes(issueBill._id)) {
        bus.issueBills.push(issueBill._id);
        await bus.save();
      }

      return res.status(200).json({
        message: `Existing bus (${busCode}) updated and linked to issue bill.`,
        bus,
      });
    }

    // 🔹 5. Create new Bus
    bus = new Bus({
      busCode,
      issueBills: [issueBill._id],
    });

    await bus.save();

    return res.status(201).json({
      message: "New bus created and linked successfully.",
      bus,
    });
  } catch (err) {
    console.error("Error creating/updating bus consumption:", err);
    res.status(400).json({ error: err.message });
  }
};

// ✅ Get all bus consumptions
exports.getBusConsumptions = async (req, res) => {
  try {
    const buses = await Bus.find()
      .populate({
        path: "issueBills",
        model: "IssueBill",
        populate: [{ path: "items.item", model: "Item" }],
      })
      .sort({ createdAt: -1 });

    res.json(buses);
  } catch (err) {
    console.error("Error fetching bus consumptions:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get single bus consumption by ID
exports.getBusConsumptionById = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id)
      .populate({
        path: "issueBills",
        model: "IssueBill",
        populate: [{ path: "items.item", model: "Item" }],
      });

    if (!bus) {
      return res.status(404).json({ error: "Bus not found." });
    }

    res.json({
      _id: bus._id,
      busCode: bus.busCode,
      issueBills: bus.issueBills.map((ib) => ({
        _id: ib._id,
        issueDate: ib.issueDate,
        department: ib.department,
        issuedBy: ib.issuedBy,
        issuedTo: ib.issuedTo,
        type: ib.type,
        totalAmount: ib.totalAmount,
        items: ib.items.map((it) => ({
          code: it.item?.code || "-",
          description: it.item?.headDescription || "",
          uqc: it.item?.unit || "-",
          quantity: it.quantity,
          rate: it.rate,
          amount: it.amount,
        })),
      })),
    });
  } catch (err) {
    console.error("Error fetching bus consumption by ID:", err);
    res.status(500).json({ error: err.message });
  }
};
