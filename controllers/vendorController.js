const Vendor = require('../models/vendor');

// Create Vendor
exports.createVendor = async (req, res) => {
  try {
    const { name, address, state, gstNumber } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Vendor name is required" });
    }

    if (gstNumber) {
      const existingVendor = await Vendor.findOne({ gstNumber: gstNumber.trim() });
      if (existingVendor) {
        return res.status(400).json({
          error: "A vendor with this GST number already exists",
          existingVendor,
        });
      }
    }

    const vendor = new Vendor({ name, address, state, gstNumber });
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

// Update vendor (❌ no code update)
exports.updateVendor = async (req, res) => {
  try {
    const { name, address, state, gstNumber } = req.body;

    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { name, address, state, gstNumber },
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
