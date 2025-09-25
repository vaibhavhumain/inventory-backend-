const mongoose = require('mongoose');
const InventoryTransaction = require('../models/InventoryTransaction');
const { ensureSufficientStock, getAllItemsSummary, getItemSummary } = require('../services/Stock');
const Bus = require('../models/Bus');

exports.issueToSub = async (req, res) => {
  try {
    const { itemId, quantity, date, note } = req.body;
    await ensureSufficientStock(itemId, 'ISSUE_TO_SUB', Number(quantity));

    const txn = await InventoryTransaction.create({
      item: itemId,
      type: 'ISSUE_TO_SUB',
      quantity,
      date: date || new Date(),
      meta: { note },
    });

    const summary = await getItemSummary(itemId);
    res.status(201).json({ ok: true, txn, summary });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};

exports.consumeFromSub = async (req, res) => {
  try {
    const { itemId, quantity, date, busId, issuedBy } = req.body;

    // 1. Ensure stock is available
    await ensureSufficientStock(itemId, 'CONSUMPTION', Number(quantity));

    // 2. Ensure bus exists
    const bus = await Bus.findById(busId);
    if (!bus) {
      return res.status(404).json({ ok: false, error: 'Bus not found' });
    }

    // 3. Save txn with bus reference
    const txn = await InventoryTransaction.create({
      item: itemId,
      type: 'CONSUMPTION',
      quantity,
      date: date || new Date(),
      meta: {
        bus: bus._id,   // ✅ store ObjectId
        note: `Issued by ${issuedBy || "system"} to ${bus.busCode}`,
      },
    });

    // 4. Populate bus for response
    await txn.populate("meta.bus", "busCode chassisNumber engineNumber model");

    const summary = await getItemSummary(itemId);
    res.status(201).json({ ok: true, txn, summary });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};

exports.sellFromSub = async (req, res) => {
  try {
    const { itemId, quantity, date, customer, note } = req.body;
    await ensureSufficientStock(itemId, 'SALE', Number(quantity));

    const txn = await InventoryTransaction.create({
      item: itemId,
      type: 'SALE',
      quantity,
      date: date || new Date(),
      meta: { customer, note },
    });

    const summary = await getItemSummary(itemId);
    res.status(201).json({ ok: true, txn, summary });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};

exports.listSummary = async (req, res) => {
  try {
    const data = await getAllItemsSummary();
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
