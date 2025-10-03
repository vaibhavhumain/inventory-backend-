const BusConsumption = require('../models/Bus');
const IssueBill = require('../models/issueBill');

// Create bus consumption (only allowed for SUB_TO_USER issue bills)
exports.createBusConsumption = async (req, res) => {
  try {
    const { chassisNumber, engineNumber, issueBillId, consumedBy } = req.body;

    const issueBill = await IssueBill.findById(issueBillId);
    if (!issueBill) {
      return res.status(404).json({ error: 'IssueBill not found' });
    }

    // Ensure correct type
    if (issueBill.type !== 'SUB_TO_USER') {
      return res.status(400).json({ error: 'Bus consumption allowed only for SUB_TO_USER issue bills' });
    }

    const busConsumption = new BusConsumption({
      chassisNumber,
      engineNumber,
      issueBill: issueBill._id,
      consumedBy,
    });

    await busConsumption.save();
    res.status(201).json(busConsumption);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get all bus consumption history
exports.getBusConsumptions = async (req, res) => {
  try {
    const consumptions = await BusConsumption.find()
      .populate({
        path: 'issueBill',
        populate: [
          { path: 'items.item', model: 'Item' }
        ],
      })
      .sort({ createdAt: -1 });

    res.json(consumptions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get bus consumption by ID
exports.getBusConsumptionById = async (req, res) => {
  try {
    const { id } = req.params;

    const busConsumption = await BusConsumption.findById(id)
      .populate({
        path: "issueBill",
        populate: [
          { path: "items.item", model: "Item" }, // populates item details
          { path: "bus", model: "Bus" }          // if you want bus details too
        ],
      });

    if (!busConsumption) {
      return res.status(404).json({ error: "Bus consumption not found" });
    }

    // Build a clean response object
    res.json({
      _id: busConsumption._id,
      busCode: busConsumption.busCode || busConsumption.bus?.busCode || "-",
      chassisNumber: busConsumption.chassisNumber,
      engineNumber: busConsumption.engineNumber,
      consumedBy: busConsumption.consumedBy || "-",

      issueBill: {
        issueDate: busConsumption.issueBill.issueDate,
        department: busConsumption.issueBill.department,
        issuedBy: busConsumption.issueBill.issuedBy,
        issuedTo: busConsumption.issueBill.issuedTo,
        type: busConsumption.issueBill.type,
        totalAmount: busConsumption.issueBill.totalAmount,

        // Each item already has amount calculated in schema
        items: busConsumption.issueBill.items.map((it) => ({
          code: it.item?.code || "-",
          description: it.item?.headDescription || "",
          uqc: it.item?.unit || "-",
          quantity: it.quantity,
          rate: it.rate,
          amount: it.amount,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
