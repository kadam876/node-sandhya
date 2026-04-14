const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const User = require('../src/models/User');

async function reassignData(targetEmail) {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const user = await User.findOne({ email: targetEmail });
        if (!user) {
            console.error(`User ${targetEmail} not found!`);
            process.exit(1);
        }

        const newAdminId = user._id.toString();
        console.log(`Reassigning all products and orders to: ${targetEmail} (ID: ${newAdminId})`);

        const pResult = await Product.updateMany({}, { adminId: newAdminId });
        const oResult = await Order.updateMany({}, { adminId: newAdminId });

        console.log(`Successfully updated ${pResult.modifiedCount} products and ${oResult.modifiedCount} orders.`);
        
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

const email = process.argv[2] || 'admin@sandhya-fashion.in';
reassignData(email);
