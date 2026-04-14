const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema({
    ownerId: { type: String, index: true },
    ownerEmail: String,
    shopName: String,
    description: String,
    location: String,
    gstNumber: String,
    bannerUrl: String,
    logoUrl: String,
    status: String, // PENDING, APPROVED, REJECTED
    createdAt: { type: Date, default: Date.now }
}, { collection: 'shops' });

shopSchema.set('toJSON', {
    transform: (document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString();
        delete returnedObject._id;
        delete returnedObject.__v;
    }
});

module.exports = mongoose.model('Shop', shopSchema);
