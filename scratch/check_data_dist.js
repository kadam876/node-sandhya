const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./src/models/Product');
const Order = require('./src/models/Order');
const User = require('./src/models/User');

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGO_URI, { family: 4 });
        console.log('Connected to MongoDB');

        const users = await User.find({ role: { $in: ['SHOP_OWNER', 'OWNER'] } });
        console.log(`Found ${users.length} potential admins.`);

        for (const user of users) {
             const prodCount = await Product.countDocuments({ adminId: user._id.toString() });
             const orderCount = await Order.countDocuments({ adminId: user._id.toString() });
             console.log(`User: ${user.name} (${user.email}) [ID: ${user._id}] -> Products: ${prodCount}, Orders: ${orderCount}`);
        }

        const unlinkedProds = await Product.countDocuments({ $or: [{ adminId: { $exists: false } }, { adminId: null }, { adminId: "" }] });
        const unlinkedOrders = await Order.countDocuments({ $or: [{ adminId: { $exists: false } }, { adminId: null }, { adminId: "" }] });
        console.log(`Unlinked Products: ${unlinkedProds}`);
        console.log(`Unlinked Orders: ${unlinkedOrders}`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
