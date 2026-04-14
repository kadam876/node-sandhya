const Shop = require('../models/Shop');
const User = require('../models/User');

exports.registerShop = async (req, res) => {
    try {
        const newShop = new Shop({
            ...req.body,
            ownerId: req.user.id,
            ownerEmail: req.user.email,
            status: 'PENDING'
        });
        await newShop.save();
        res.status(201).json(newShop.toJSON());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.setupShop = async (req, res) => {
    try {
        const { businessName, address, gstNo, phone } = req.body;

        // Update the user's own profile with shop details
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            {
                shopName: businessName,
                address,
                gstNumber: gstNo,
                phone,
                isProfileComplete: true
            },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'Shop setup complete', user: updatedUser.toJSON() });
    } catch (err) {
        console.error('SHOP SETUP ERROR:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.getShops = async (req, res) => {
    try {
        const shops = await Shop.find({ ownerId: req.user.id });
        res.json(shops.map(s => s.toJSON()));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
