require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const Item = require("../models/item");
const Category = require("../models/Category");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const cat = await Category.findOne({ prefix: "RM" }); 
  const item = await Item.create({
    category: cat._id,
    headDescription: "Test Item For Code",
    gstRate: 18,
  });
  console.log("Created:", item.code, item._id.toString());
  await mongoose.disconnect();
})();
