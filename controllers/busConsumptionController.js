const BusConsumption = require('../models/BusConsumption');
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
