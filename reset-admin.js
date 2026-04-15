require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

const EMAIL    = process.argv[2] || 'owner@sandhya.com';
const PASSWORD = process.argv[3] || 'OwnerPassword123!';

async function resetAdminPassword() {
    try {
        await mongoose.connect(process.env.MONGO_URI, { family: 4 });
        console.log('Connected to:', mongoose.connection.host);

        // Find existing user
        let user = await User.findOne({ email: EMAIL });

        if (user) {
            // Update password
            const hashed = await bcrypt.hash(PASSWORD, 8);
            user.password = hashed;
            await user.save();
            console.log(`\n✅ Password reset for: ${user.email}`);
            console.log(`   Role: ${user.role}`);
            console.log(`   ID:   ${user._id}`);
        } else {
            // Create admin if not exists
            const hashed = await bcrypt.hash(PASSWORD, 8);
            user = new User({
                name: 'Sandhya Fashion Owner',
                email: EMAIL,
                password: hashed,
                role: 'OWNER',
                shopName: 'Sandhya Fashion',
                phone: '+917573943992',
                address: 'Shop No- B/5083, Upper Ground Floor, Global Textile Market Surat 395010',
                isVerified: true,
                isActive: true,
                isProfileComplete: true
            });
            await user.save();
            console.log(`\n✅ Admin created: ${user.email}`);
        }

        console.log(`\n🔑 Login with:`);
        console.log(`   Email:    ${EMAIL}`);
        console.log(`   Password: ${PASSWORD}`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('ERROR:', err.message);
        process.exit(1);
    }
}

resetAdminPassword();
