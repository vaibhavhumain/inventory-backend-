const mongoose = require('mongoose');

const billItemSchema = new mongoose.Schema ({
    item: {type: mongoose.Schema.Types.ObjectId, ref:'Item', required:true},
    quantity: {type: Number, required:true},
    rate: {type: Number, required:true},
    amount: {type: Number}
}, {_id: false});

const purchaseBillSchema = new mongoose.Schema({
    billNo: {type: String, required:true, unique:true},
    billDate: {type:Date, required:true},
    supplierName: {type:String, required:true},
    items: [billItemSchema],
    totalAmount: {type: Number},
    createdAt: {type: Date, default: Date.now}
} , {timestamps: true });

module.exports = mongoose.model('PurchaseBill', purchaseBillSchema);