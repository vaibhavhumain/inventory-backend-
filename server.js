require('dotenv').config();
const express = require("express");
const cors = require("cors");
const connectDB = require('./config/db');
const itemRoutes = require('./routes/itemRoutes');
const authRoutes = require('./routes/authRoutes');
const purchaseBillInvoice = require('./routes/purchaseBillInvoice');
const stockRoutes = require('./routes/stockLedgerRoutes');
const exportRoutes = require("./routes/exportRoutes");
const importRoutes = require("./routes/importRoutes");
const issueBillRoutes = require('./routes/issueBillRoutes');
const analysisRoutes = require('./routes/analysisRoutes');
const adminRoutes = require('./routes/admin');
const vendorRoutes = require('./routes/vendorRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const stockRoutes2 = require('./routes/stockRoutes');
const busConsumptionRoutes = require('./routes/busConsumptionRoute');
connectDB();

const app = express();

app.use(cors({
  origin: [
    "https://invetrack.netlify.app",  
    "http://localhost:3000",
    "http://192.168.1.12:3000"
  ],
  credentials: true
}));
    
app.use(express.json());

app.use('/api/items',itemRoutes);
app.use('/api/auth', authRoutes);
console.log("✅ Purchase Invoice routes mounted at /api/purchase-invoices");
app.use('/api/purchase-invoices', purchaseBillInvoice);
app.use('/api/stock-ledger', stockRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/import', importRoutes);
app.use('/api/issue-bills', issueBillRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/stock', stockRoutes2);
app.use('/api/bus-consumption', busConsumptionRoutes);
app.get('/',(_req,res) => {
    res.json({status: 'ok', service: 'inventory-backend'});
    res.end();
});
app.use((req,res,_next) => {
    res.status(404).json({error:`Route ${req.originalUrl} not found`});
});

app.use((err,_req,res,_next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({error: err.message || 'Server error'});
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
 