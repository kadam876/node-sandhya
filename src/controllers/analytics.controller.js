const Order = require('../models/Order');
const Product = require('../models/Product');
const mongoose = require('mongoose');

exports.getDashboardStats = async (req, res) => {
    try {
        const adminId = req.user.id;
        const totalProducts = await Product.countDocuments({ adminId, isActive: true });
        const lowStockItems = await Product.countDocuments({ adminId, isActive: true, stockQuantity: { $lt: 20 } });
        const totalOrders = await Order.countDocuments({ adminId });
        
        const revenueResult = await Order.aggregate([
            { $match: { adminId } },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]);
        const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

        res.json({ totalProducts, totalOrders, lowStockItems, totalRevenue });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getFullDashboard = async (req, res) => {
    try {
        const adminId = req.user.id;
        
        // 1. Stats
        const totalProducts = await Product.countDocuments({ adminId, isActive: true });
        const lowStockItems = await Product.countDocuments({ adminId, isActive: true, stockQuantity: { $lt: 20 } });
        const totalOrders = await Order.countDocuments({ adminId });
        const revenueResult = await Order.aggregate([
            { $match: { adminId } },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]);
        const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

        const stats = { totalProducts, lowStockItems, totalOrders, totalRevenue };

        // 2. Sales Over Time (Last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const salesByDate = await Order.aggregate([
            { $match: { adminId, orderDate: { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                    sales: { $sum: "$totalAmount" },
                    orders: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } },
            { $project: { _id: 0, date: "$_id", sales: 1, orders: 1 } }
        ]);

        // 3. Category Distribution
        const categories = await Product.aggregate([
            { $match: { adminId, isActive: true } },
            { $group: { _id: "$category", count: { $sum: 1 } } },
            { $project: { _id: 0, category: { $ifNull: ["$_id", "Uncategorized"] }, count: 1 } }
        ]);

        // 4. Order Status Distribution
        const statusDistribution = await Order.aggregate([
            { $match: { adminId } },
            { $group: { _id: "$status", count: { $sum: 1 } } },
            { $project: { _id: 0, status: "$_id", count: 1 } }
        ]);

        // 5. Top Selling Products
        const topProducts = await Order.aggregate([
            { $match: { adminId } },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.productId",
                    name: { $first: "$items.productName" },
                    image: { $first: "$items.productImage" },
                    quantity: { $sum: "$items.quantity" }
                }
            },
            { $sort: { quantity: -1 } },
            { $limit: 10 },
            { $project: { _id: 0, productId: "$_id", name: 1, image: 1, quantity: 1 } }
        ]);

        // 6. Predictions (Semi-realistic stub based on avg daily sales)
        const avgDailySales = salesByDate.length > 0 ? totalRevenue / 30 : 500;
        const predictions = [];
        for (let i = 1; i <= 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            predictions.push({
                date: date.toISOString().split('T')[0],
                sales: Math.round(avgDailySales * (0.8 + Math.random() * 0.4))
            });
        }

        res.json({
            stats,
            sales: { salesByDate },
            categories: { categories },
            orderStatus: { statusDistribution },
            topProducts,
            predictions
        });
    } catch (err) {
        console.error("DASHBOARD AGGREGATION ERROR:", err);
        res.status(500).json({ error: err.message });
    }
};

exports.getSalesData = async (req, res) => {
    try {
        const adminId = req.user.id;
        const salesByDate = await Order.aggregate([
            { $match: { adminId } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                    sales: { $sum: "$totalAmount" },
                    orders: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } },
            { $project: { _id: 0, date: "$_id", sales: 1, orders: 1 } }
        ]);
        res.json(salesByDate);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getCategoryDistribution = async (req, res) => {
    try {
        const adminId = req.user.id;
        const categories = await Product.aggregate([
            { $match: { adminId, isActive: true } },
            { $group: { _id: "$category", count: { $sum: 1 } } },
            { $project: { _id: 0, category: { $ifNull: ["$_id", "Uncategorized"] }, count: 1 } }
        ]);
        res.json({ categories });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
exports.getOrderStatusDistribution = async (req, res) => {
    try {
        const adminId = req.user.id;
        const statusDistribution = await Order.aggregate([
            { $match: { adminId } },
            { $group: { _id: "$status", count: { $sum: 1 } } },
            { $project: { _id: 0, status: "$_id", count: 1 } }
        ]);
        res.json({ statusDistribution });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getTopSellingProducts = async (req, res) => {
    try {
        const adminId = req.user.id;
        const topProducts = await Order.aggregate([
            { $match: { adminId } },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.productId",
                    name: { $first: "$items.productName" },
                    image: { $first: "$items.productImage" },
                    quantity: { $sum: "$items.quantity" }
                }
            },
            { $sort: { quantity: -1 } },
            { $limit: req.query.limit ? parseInt(req.query.limit) : 10 },
            { $project: { _id: 0, productId: "$_id", name: 1, image: 1, quantity: 1 } }
        ]);
        res.json(topProducts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getSalesPredictions = async (req, res) => {
    const predictions = [];
    for (let i = 1; i <= 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        predictions.push({
            date: date.toISOString().split('T')[0],
            sales: Math.round(500 * (0.8 + Math.random() * 0.4))
        });
    }
    res.json(predictions);
};


