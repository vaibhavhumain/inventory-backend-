const mongoose = require('mongoose');

const dailyStockSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    in: { type: Number, default: 0 },
    out: { type: Number, default: 0 }
}, { _id: false });

const itemSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },   
    category: { type: String, required: true, enum: [
        "adhesive", "bought out", "chemicals", "consumables",
        "electricals", "electronics", "hardware", "paints",
        "plastics", "raw material", "rubbers"
    ]},
    description: { type: String, required: true },          
    plantName: { type: String },                            
    weight: { type: Number },                               
    unit: { type: String },                                 
    closingQty: { type: Number, default: 0 },               
    stockTaken: { type: String },                           
    dailyStock: [dailyStockSchema],                         
    location: { type: String },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Item', itemSchema);

