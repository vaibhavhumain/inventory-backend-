const mongoose = require('mongoose');
const itemSchema = new mongoose.Schema({
    code:{type:String, required:true, unique:true },
    name:{type:String, required:true },
    category: String,
    quantity: {type: Number, default: 0},
    unit: String,
    location: String,
    createAt: {type: Date, default: Date.now},

});

module.exports = mongoose.model('Item',itemSchema);