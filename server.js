require('dotenv').config();
const express = require("express");
const cors = require("cors");
const connectDB = require('./config/db');
const itemRoutes = require('./routes/itemRoutes');
const authRoutes = require('./routes/authRoutes');
const purchaseBillRoutes = require('./routes/purchaseBillRoutes');
const stockRoutes = require('./routes/stockLedgerRoutes');
connectDB();

const app = express();

app.use(cors({
  origin: [
    "https://invetrack.netlify.app",  
    "http://localhost:3000"
  ],
  credentials: true
}));
    
app.use(express.json());

app.use('/api/items',itemRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/purchase-bills', purchaseBillRoutes);
app.use('/api/stock', stockRoutes);

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
