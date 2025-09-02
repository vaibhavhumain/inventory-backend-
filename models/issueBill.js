const mongoose = require('mongoose');

const billItemSchema = new mongoose.Schema({
    item: {type:mongoose.Schema.Types.ObjectId, ref:'Item', required:true},
    quantity: {type:Number, required:true},
}, {_id: false});

const issueBillSchema = new mongoose.Schema({
    issueNo: {type: String, required:true, unique:true},
    issueDate: {type: Date, default: Date.now},
    department: {type:String, required:true},
    items: [billItemSchema],
    issuedBy: {type:String},
    createdAt: {type:Date, default: Date.now}
}, {timestamps: true });


module.exports = mongoose.model('IssueBill', issueBillSchema);  