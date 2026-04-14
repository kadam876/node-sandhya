require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./src/models/Product');

async function checkProducts() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');
        
        const total = await Product.countDocuments({});
        const active = await Product.countDocuments({ isActive: true });
        console.log(`Total Products: ${total}`);
        console.log(`Active Products: ${active}`);
        
        if (active > 0) {
            const sample = await Product.findOne({ isActive: true });
            console.log('Sample Product:', JSON.stringify(sample, null, 2));
        } else if (total > 0) {
            const sample = await Product.findOne({});
            console.log('Sample Inactive Product:', JSON.stringify(sample, null, 2));
        } else {
            console.log('No products found in the database.');
        }
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkProducts();
