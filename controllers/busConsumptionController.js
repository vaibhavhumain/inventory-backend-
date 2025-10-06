const Bus = require("../models/Bus");
const IssueBill = require("../models/issueBill");

exports.createBusConsumption = async (req, res) => {
  try {
    const {
      busCode,
      chassisNumber,
      engineNumber,
      model,
      remarks,
      issueBillId,
      consumedBy,
    } = req.body;

    if (!busCode || !chassisNumber || !engineNumber) {
      return res
        .status(400)
        .json({ error: "Bus Code, Chassis Number, and Engine Number are required" });
    }

    const issueBill = await IssueBill.findById(issueBillId);
    if (!issueBill) {
      return res.status(404).json({ error: "IssueBill not found" });
    }

    if (issueBill.type !== "SUB_TO_USER") {
      return res
        .status(400)
        .json({ error: "Bus consumption allowed only for SUB_TO_USER issue bills" });
    }

    let bus = await Bus.findOne({ busCode });

    if (bus) {
      if (!bus.issueBills.includes(issueBill._id)) {
        bus.issueBills.push(issueBill._id);
      }

      bus.chassisNumber = bus.chassisNumber || chassisNumber;
      bus.engineNumber = bus.engineNumber || engineNumber;
      if (model) bus.model = model;
      if (remarks || consumedBy) bus.remarks = remarks || consumedBy;

      await bus.save();

      return res.status(200).json({
        message: `Existing bus (${busCode}) updated and linked to new Issue Bill.`,
        bus,
      });
    }

    bus = new Bus({
      busCode,
      chassisNumber,
      engineNumber,
      model,
      remarks: remarks || consumedBy || null,
      issueBills: [issueBill._id],
    });

    await bus.save();

    res.status(201).json({
      message: "New bus created and linked successfully",
      bus,
    });
  } catch (err) {
    console.error("Error creating/updating bus consumption:", err);
    res.status(400).json({ error: err.message });
  }
};

// Get all bus consumption history
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

// Get single bus consumption
exports.getBusConsumptionById = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id)
      .populate({
        path: "issueBills",
        model: "IssueBill",
        populate: [{ path: "items.item", model: "Item" }],
      });

    if (!bus) return res.status(404).json({ error: "Bus not found" });

    res.json({
      _id: bus._id,
      busCode: bus.busCode,
      chassisNumber: bus.chassisNumber,
      engineNumber: bus.engineNumber,
      model: bus.model,
      remarks: bus.remarks,
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
