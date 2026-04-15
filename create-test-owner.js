require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

const EMAIL    = process.argv[2] || 'owner@sandhya.com';
const PASSWORD = process.argv[3] || 'admin123';

async function createTestOwner() {
    try {
        await mongoose.connect(process.env.MONGO_URI, { family: 4 });
        console.log('Connected to:', mongoose.connection.host);

        // Find existing user
        let user = await User.findOne({ email: EMAIL });

        const hashed = await bcrypt.hash(PASSWORD, 8);

        if (user) {
            // Update existing user to be SHOP_OWNER
            user.password = hashed;
            user.role = 'SHOP_OWNER';
            user.isVerified = true;
            user.isActive = true;
            user.isProfileComplete = true;
            await user.save();
            console.log(`\n✅ Existing user updated to SHOP_OWNER: ${user.email}`);
        } else {
            // Create new SHOP_OWNER
            user = new User({
                name: 'Shop Owner',
                email: EMAIL,
                password: hashed,
                role: 'SHOP_OWNER',
                isVerified: true,
                isActive: true,
                isProfileComplete: true,
                shopName: 'Sandhya Fashion'
            });
            await user.save();
            console.log(`\n✅ Test Shop Owner created: ${user.email}`);
        }

        console.log(`\n🔑 Login with:`);
        console.log(`   Email:    ${EMAIL}`);
        console.log(`   Password: ${PASSWORD}`);
        console.log(`   Role:     SHOP_OWNER`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('ERROR:', err.message);
        process.exit(1);
    }
}

createTestOwner();
