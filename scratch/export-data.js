const mongoose = require('mongoose');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const User = require('../src/models/User');

async function exportData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const exportDir = path.join(__dirname, 'export');
        if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir);

        console.log('Starting export from ' + mongoose.connection.name + '...');
        
        const [users, products, orders] = await Promise.all([
            User.find({}).lean(),
            Product.find({}).lean(),
            Order.find({}).lean()
        ]);

        fs.writeFileSync(path.join(exportDir, 'users.json'), JSON.stringify(users, null, 2));
        fs.writeFileSync(path.join(exportDir, 'products.json'), JSON.stringify(products, null, 2));
        fs.writeFileSync(path.join(exportDir, 'orders.json'), JSON.stringify(orders, null, 2));

        console.log(`Exported ${users.length} users, ${products.length} products, and ${orders.length} orders.`);
        process.exit(0);
    } catch (err) {
        console.error('Export failed:', err);
        process.exit(1);
    }
}

exportData();
