const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema({
  code: { type: String, unique: true },
  name: { type: String, required: true},
  address: { type: String, required: true },
  state: { type: String, required: true },
  gstNumber: { type: String, required: true, unique: true, trim: true },}, { timestamps: true });

vendorSchema.pre("save", async function (next) {
  if (!this.isNew) return next(); 

  try {
    const prefix = "GC/SC/";

    const lastVendor = await this.constructor.findOne().sort({ createdAt: -1 });

    let nextNumber = 1;
    if (lastVendor && lastVendor.code) {
      const match = lastVendor.code.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
             
    this.code = prefix + String(nextNumber).padStart(4, "0");
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Vendor", vendorSchema);
