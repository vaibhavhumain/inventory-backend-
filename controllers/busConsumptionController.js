const Bus = require("../models/Bus");
const IssueBill = require("../models/issueBill");

exports.createBusConsumption = async (req, res) => {
  try {
    const { busCode, issueBillId, ownerName, chassisNo, engineNo, model } = req.body;

    if (!busCode || !issueBillId) {
      return res
        .status(400)
        .json({ error: "Bus Code and Issue Bill ID are required." });
    }

    // Fetch Issue Bill
    const issueBill = await IssueBill.findById(issueBillId);
    if (!issueBill) return res.status(404).json({ error: "Issue Bill not found." });

    if (issueBill.type !== "SUB_TO_USER") {
      return res.status(400).json({
        error: "Bus consumption allowed only for SUB_TO_USER issue bills.",
      });
    }

    // Find or update existing bus
    let bus = await Bus.findOne({ busCode });

    if (bus) {
      bus.ownerName = ownerName || bus.ownerName;
      bus.chassisNo = chassisNo || bus.chassisNo;
      bus.engineNo = engineNo || bus.engineNo;
      bus.model = model || bus.model;

      if (!bus.issueBills.includes(issueBill._id)) {
        bus.issueBills.push(issueBill._id);
      }

      await bus.save();
      return res.status(200).json({
        message: `Existing bus (${busCode}) updated and linked to issue bill.`,
        bus,
      });
    }

    // Create new Bus
    bus = new Bus({
      busCode,
      ownerName,
      chassisNo,
      engineNo,
      model,
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
        populate: {
          path: "items.item",
          model: "Item",
          select: "code headDescription subDescription unit", // ✅ Select these fields
        },
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
        populate: {
          path: "items.item",
          model: "Item",
          select: "code headDescription subDescription unit", // ✅ Ensure these fields are included
        },
      });

    if (!bus) {
      return res.status(404).json({ error: "Bus not found." });
    }

    res.json({
      _id: bus._id,
      busCode: bus.busCode,
      ownerName: bus.ownerName,
      chassisNo: bus.chassisNo,
      engineNo: bus.engineNo,
      model: bus.model,
      createdAt: bus.createdAt,
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
          description: it.item?.headDescription || it.item?.subDescription || "-",
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
