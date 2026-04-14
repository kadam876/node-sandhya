require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./src/models/Product');

async function testMongo() {
    try {
        await mongoose.connect(process.env.MONGO_URI, { family: 4 });
        console.log("Connected to MongoDB:", process.env.MONGO_URI);

        const testProduct = new Product({
            name: "Test Node Product",
            category: "Tops",
            price: 50,
            adminId: "123456"
        });

        await testProduct.save();
        console.log("Product saved successfully!");
        
        await Product.deleteOne({ _id: testProduct._id });
        console.log("Cleanup complete!");
        
        process.exit(0);
    } catch(err) {
        console.error("CRASH:", err);
        process.exit(1);
    }
}
testMongo();
