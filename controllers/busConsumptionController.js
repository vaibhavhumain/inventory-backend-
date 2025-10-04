  const Bus = require('../models/Bus');
  const IssueBill = require('../models/issueBill');

// Create bus linked to issue bill (SUB_TO_USER only)
exports.createBusConsumption = async (req, res) => {
  try {
    const { chassisNumber, engineNumber, issueBillId, consumedBy } = req.body;

    const issueBill = await IssueBill.findById(issueBillId);
    if (!issueBill) {
      return res.status(404).json({ error: 'IssueBill not found' });
    }

    if (issueBill.type !== 'SUB_TO_USER') {
      return res.status(400).json({ error: 'Bus consumption allowed only for SUB_TO_USER issue bills' });
    }

    const bus = new Bus({
      chassisNumber,
      engineNumber,
      issueBill: issueBill._id,
      remarks: consumedBy || null,
    });

    await bus.save();
    res.status(201).json(bus);
  } catch (err) {
    console.error("Error creating bus consumption:", err);
    res.status(400).json({ error: err.message });
  }
};

// Get all bus consumption history
exports.getBusConsumptions = async (req, res) => {
  try {
    const buses = await Bus.find()
      .populate({
        path: 'issueBills',
        model: 'IssueBill',
        populate: [{ path: 'items.item', model: 'Item' }],
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
      remarks: bus.remarks,
      issueBill: bus.issueBill
        ? {
            issueDate: bus.issueBill.issueDate,
            department: bus.issueBill.department,
            issuedBy: bus.issueBill.issuedBy,
            issuedTo: bus.issueBill.issuedTo,
            type: bus.issueBill.type,
            totalAmount: bus.issueBill.totalAmount,
            items: bus.issueBill.items.map(it => ({
              code: it.item?.code || "-",
              description: it.item?.headDescription || "",
              uqc: it.item?.unit || "-",
              quantity: it.quantity,
              rate: it.rate,
              amount: it.amount,
            })),
          }
        : null,
    });
  } catch (err) {
    console.error("Error fetching bus consumption by ID:", err);
    res.status(500).json({ error: err.message });
  }
};
