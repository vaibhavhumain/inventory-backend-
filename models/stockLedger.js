const mongoose = require('mongoose');

const stockLedgerSchema = new mongoose.Schema({
    itemName :  { type: String, required: true },
    quantity : { type: Number, required: true },
    type : { type: String, required:true, enum: ['IN','OUT'], required: true },
    date : {type: Date, default: Date.now },
});

module.exports = mongoose.model('StockLedger', stockLedgerSchema);