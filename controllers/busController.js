const Bus = require("../models/Bus");
const IssueBill = require("../models/issueBill");

// ✅ Create a new bus
exports.createBus = async (req, res) => {
  try {
    const { busCode, ownerName, chassisNo, engineNo, model, serialNo } = req.body;

    if (!busCode || !model) {
      return res.status(400).json({ error: "Bus Code and Model are required." });
    }

    // 🔍 Check if bus already exists
    let existing = await Bus.findOne({ busCode });
    if (existing) {
      return res.status(400).json({ error: "Bus already exists with this code." });
    }

    // 🧾 Create new bus
    const newBus = new Bus({
      busCode,
      ownerName,
      chassisNo,
      engineNo,
      model,
      serialNo,
      issueBills: [],
    });

    await newBus.save();

    return res.status(201).json({
      message: "✅ Bus created successfully.",
      bus: newBus,
    });
  } catch (err) {
    console.error("Error creating bus:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get all buses
exports.getBuses = async (req, res) => {
  try {
    const buses = await Bus.find()
      .populate({
        path: "issueBills",
        model: "IssueBill",
        populate: [{ path: "items.item", model: "Item" }],
      })
      .sort({ createdAt: -1 });

    res.status(200).json(buses);
  } catch (err) {
    console.error("Error fetching buses:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get a single bus by ID or busCode
exports.getBusByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const bus = await Bus.findOne({ busCode: code })
      .populate({
        path: "issueBills",
        model: "IssueBill",
        populate: [{ path: "items.item", model: "Item" }],
      });

    if (!bus) {
      return res.status(404).json({ error: "Bus not found." });
    }

    res.status(200).json(bus);
  } catch (err) {
    console.error("Error fetching bus:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Update a bus (optional use later)
exports.updateBus = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const bus = await Bus.findByIdAndUpdate(id, updates, { new: true });
    if (!bus) return res.status(404).json({ error: "Bus not found." });

    res.status(200).json({ message: "✅ Bus updated successfully.", bus });
  } catch (err) {
    console.error("Error updating bus:", err);
    res.status(500).json({ error: err.message });
  }
};
