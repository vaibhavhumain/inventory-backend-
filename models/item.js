const mongoose = require('mongoose');

const dailyStockSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    in: { type: Number, default: 0 },
    out: { type: Number, default: 0 },
    closingQty: { type: Number, default: 0 },
    mainStoreQty: { type: Number, default: 0 },   
    subStoreQty: { type: Number, default: 0 }   
}, { _id: false });

const itemSchema = new mongoose.Schema({
    code: { type: String, unique: true },   
    category: { type: String },
    description: { type: String },          
    plantName: { type: String },                            
    weight: { type: Number },                               
    unit: { type: String },                                 
    closingQty: { type: Number, default: 0 },               
    stockTaken: { type: String },                           
    dailyStock: [dailyStockSchema],                         
    location: { type: String },
    mainStoreQty: { type: Number, default: 0 },   
    subStoreQty: { type: Number, default: 0 },  
    remarks: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Item', itemSchema);
