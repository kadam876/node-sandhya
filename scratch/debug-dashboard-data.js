const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const User = require('../src/models/User');

async function debugData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const userCount = await User.countDocuments();
        const productCount = await Product.countDocuments();
        const orderCount = await Order.countDocuments();
        console.log(`Total - Users: ${userCount}, Products: ${productCount}, Orders: ${orderCount}`);

        const sampleUser = await User.findOne({ email: 'test1@gmail.com' });
        console.log('Sample User (test1):', JSON.stringify(sampleUser, null, 2));

        const shop1User = await User.findOne({ email: 'shop1@gmail.com' });
        console.log('Sample User (shop1):', JSON.stringify(shop1User, null, 2));

        const unownedProducts = await Product.countDocuments({ adminId: { $exists: false } });
        const unownedOrders = await Order.countDocuments({ adminId: { $exists: false } });
        console.log(`Unowned - Products: ${unownedProducts}, Orders: ${unownedOrders}`);

        const allAdminIdsProducts = await Product.distinct('adminId');
        const allAdminIdsOrders = await Order.distinct('adminId');
        console.log('AdminIds in Products:', allAdminIdsProducts);
        console.log('AdminIds in Orders:', allAdminIdsOrders);

        // Check if those AdminIds belong to any users
        for (const id of allAdminIdsProducts) {
            const owner = await User.findById(id);
            console.log(`Product Owner for ${id}: ${owner ? owner.email : 'NOT FOUND'}`);
        }

        // Check if there are any products for this user
        if (sampleUser) {
            const userIdString = sampleUser._id.toString();
            const productsWithUserIdStr = await Product.countDocuments({ adminId: userIdString });
            console.log(`Products with adminId (string) ${userIdString}: ${productsWithUserIdStr}`);
            
            const productsWithUserIdObj = await Product.countDocuments({ adminId: sampleUser._id });
            console.log(`Products with adminId (ObjectId) ${userIdString}: ${productsWithUserIdObj}`);
        }

        process.exit(0);
    } catch (err) {
        console.error('Debug failed:', err);
        process.exit(1);
    }
}

debugData();
