const mongoose = require("mongoose");

const billItemSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    quantity: { type: Number, required: true },
    rate: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const issueBillSchema = new mongoose.Schema(
  {
    issueDate: { type: Date, default: Date.now },
    department: { type: String, required: true },

    // ✅ Added voucher fields
    voucherNumber: {
      type: String,
      required: true,
      unique: true,
    },
    voucherDate: { type: Date, default: Date.now },

    type: {
      type: String,
      enum: ["MAIN_TO_SUB", "SUB_TO_USER", "SUB_TO_SALE"],
      required: true,
    },

    issuedTo: {
      type: String,
      validate: {
        validator: function (v) {
          if (["SUB_TO_USER", "SUB_TO_SALE"].includes(this.type)) {
            return v && v.trim().length > 0;
          }
          return true;
        },
        message:
          "issuedTo is required when type is SUB_TO_USER or SUB_TO_SALE",
      },
    },

    items: [billItemSchema],
    totalAmount: { type: Number, default: 0 },

    issuedBy: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String },
    },

    bus: { type: mongoose.Schema.Types.ObjectId, ref: "Bus" },
  },
  { timestamps: true }
);

// ✅ Pre-save hook: calculate item amounts & total
issueBillSchema.pre("save", function (next) {
  this.items.forEach((it) => {
    it.amount = it.quantity * (it.rate || 0);
  });
  this.totalAmount = this.items.reduce((sum, it) => sum + it.amount, 0);
  next();
});

// ✅ Optional auto-generate voucher number (e.g. "ISS-0001")
issueBillSchema.pre("validate", async function (next) {
  if (!this.voucherNumber) {
    const count = await mongoose.model("IssueBill").countDocuments();
    this.voucherNumber = `ISS-${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

module.exports = mongoose.model("IssueBill", issueBillSchema);
