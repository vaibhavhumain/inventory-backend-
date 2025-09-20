const Vendor = require('../models/vendor');

// Create Vendor
exports.createVendor = async (req, res) => {
  try {
    const { code, name, address, state, gstNumber } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: "Vendor code and name are required" });
    }

    const vendor = new Vendor({ code, name, address, state, gstNumber });
    await vendor.save();

    res.status(201).json(vendor);
  } catch (err) {
    console.error("Error creating vendor:", err);
    res.status(400).json({ error: err.message });
  }
};

// Get all vendors
exports.getVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find().sort({ name: 1 });
    res.json(vendors);
  } catch (err) {
    console.error("Error fetching vendors:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get vendor by ID
exports.getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ error: "Vendor not found" });
    res.json(vendor);
  } catch (err) {
    console.error("Error fetching vendor:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Update vendor
exports.updateVendor = async (req, res) => {
  try {
    const { code, name, address, state, gstNumber } = req.body;

    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { code, name, address, state, gstNumber },
      { new: true, runValidators: true }
    );

    if (!vendor) return res.status(404).json({ error: "Vendor not found" });
    res.json({ message: "Vendor updated successfully", vendor });
  } catch (err) {
    console.error("Error updating vendor:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Delete vendor
exports.deleteVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);
    if (!vendor) return res.status(404).json({ error: "Vendor not found" });
    res.json({ message: "Vendor deleted successfully" });
  } catch (err) {
    console.error("Error deleting vendor:", err);
    res.status(500).json({ error: "Server error" });
  }
};
