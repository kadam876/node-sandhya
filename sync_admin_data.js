require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('./src/models/Order');
const Product = require('./src/models/Product');
const User = require('./src/models/User');

// Configuration - Change this to the Admin ID you want to link data to
// Or leave empty to automatically pick the first Admin found
const TARGET_ADMIN_EMAIL = process.argv[2] || ''; 
const SEED_DATA = process.argv.includes('--seed');

async function syncData() {
    try {
        console.log('Connecting to database...');
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sandhya-fashion';
        await mongoose.connect(mongoUri, { family: 4 });
        console.log('Connected to:', mongoose.connection.host);

        let admin;
        if (TARGET_ADMIN_EMAIL) {
            admin = await User.findOne({ email: TARGET_ADMIN_EMAIL });
        } else {
            // Find any user with a role that looks like admin
            admin = await User.findOne({ role: { $in: ['ADMIN', 'SHOP_OWNER', 'OWNER'] } });
        }

        if (!admin) {
            console.error('ERROR: No admin user found in database.');
            console.log('Please create an admin account first through the signup page.');
            process.exit(1);
        }

        console.log(`Target Admin: ${admin.name} (${admin.email}) [ID: ${admin._id}]`);

        // Update Products
        const productUpdate = await Product.updateMany(
            { $or: [{ adminId: { $exists: false } }, { adminId: null }, { adminId: "" }] },
            { $set: { adminId: admin._id.toString() } }
        );
        console.log(`Updated ${productUpdate.modifiedCount} products.`);

        // Update Orders
        const orderUpdate = await Order.updateMany(
            { $or: [{ adminId: { $exists: false } }, { adminId: null }, { adminId: "" }] },
            { $set: { adminId: admin._id.toString() } }
        );
        console.log(`Updated ${orderUpdate.modifiedCount} orders.`);

        if (SEED_DATA) {
            console.log('Seeding sample analytics data...');
            await seedSampleData(admin._id.toString());
        }

        console.log('Sync complete.');
        process.exit(0);
    } catch (err) {
        console.error('SYNC ERROR:', err);
        process.exit(1);
    }
}

async function seedSampleData(adminId) {
    // 1. Create Sample Products if none exist
    const productCount = await Product.countDocuments({ adminId });
    if (productCount === 0) {
        console.log('Creating sample products...');
        const sampleProducts = [
            { name: 'Classic Silk Saree', category: 'Sarees', price: 2500, stockQuantity: 45, adminId, isActive: true },
            { name: 'Designer Kurtis', category: 'Kurtis', price: 1200, stockQuantity: 15, adminId, isActive: true },
            { name: 'Bridal Lehenga', category: 'Lehengas', price: 15000, stockQuantity: 5, adminId, isActive: true },
            { name: 'Cotton Salwar Suit', category: 'Suits', price: 1800, stockQuantity: 60, adminId, isActive: true },
        ];
        await Product.insertMany(sampleProducts);
    }

    // 2. Create Sample Orders for the last 30 days
    const orderCount = await Order.countDocuments({ adminId });
    if (orderCount === 0) {
        console.log('Creating sample orders for the last 30 days...');
        const orders = [];
        for (let i = 0; i < 40; i++) {
            const date = new Date();
            date.setDate(date.getDate() - Math.floor(Math.random() * 30));
            
            orders.push({
                adminId,
                userId: 'sample_user',
                totalAmount: Math.floor(Math.random() * 5000) + 500,
                status: ['DELIVERED', 'SHIPPED', 'PENDING'][Math.floor(Math.random() * 3)],
                orderDate: date,
                items: [
                    { productName: 'Sample Product', quantity: 1, unitPrice: 1000, totalPrice: 1000 }
                ]
            });
        }
        await Order.insertMany(orders);
    }
}

syncData();
