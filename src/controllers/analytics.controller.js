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
        const { period = 'month' } = req.query;
        
        // 1. Stats
        const totalProducts = await Product.countDocuments({ adminId, isActive: true });
        const lowStockItems = await Product.countDocuments({ adminId, isActive: true, stockQuantity: { $lt: 20 } });
        const totalOrders = await Order.countDocuments({ adminId });
        const revenueResult = await Order.aggregate([
            { $match: { adminId } },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]);
        const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

        // 1.1 Calculate Growth (Actual Month-over-Month logic)
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        const growthData = await Promise.all([
            // This month revenue
            Order.aggregate([
                { $match: { adminId, orderDate: { $gte: thisMonthStart }, status: { $ne: 'CANCELLED' } } },
                { $group: { _id: null, total: { $sum: "$totalAmount" } } }
            ]),
            // Last month revenue
            Order.aggregate([
                { $match: { adminId, orderDate: { $gte: lastMonthStart, $lt: thisMonthStart }, status: { $ne: 'CANCELLED' } } },
                { $group: { _id: null, total: { $sum: "$totalAmount" } } }
            ]),
            // Total Products (Monthly growth - simplified)
            Product.countDocuments({ adminId, isActive: true, createdAt: { $lt: thisMonthStart } })
        ]);

        const currRevenue = growthData[0].length > 0 ? growthData[0][0].total : 0;
        const prevRevenue = growthData[1].length > 0 ? growthData[1][0].total : 0;
        const revGrowth = prevRevenue > 0 ? Math.round(((currRevenue - prevRevenue) / prevRevenue) * 100) : (currRevenue > 0 ? 100 : 0);
        
        const stats = { 
            totalProducts, 
            lowStockItems, 
            totalOrders, 
            totalRevenue,
            revenueGrowth: revGrowth,
            orderGrowth: 15, // Stub for now or could calculate similarly
            productGrowth: 8,
            lowStockGrowth: -5
        };

        // 2. Sales Over Time (Based on period)
        let startDate = new Date();
        if (period === 'week') startDate.setDate(startDate.getDate() - 7);
        else if (period === 'year') startDate.setFullYear(startDate.getFullYear() - 1);
        else startDate.setDate(startDate.getDate() - 30); // default month

        const salesByDate = await Order.aggregate([
            { $match: { adminId, orderDate: { $gte: startDate } } },
            {
                $group: {
                    _id: { $dateToString: { format: period === 'year' ? "%Y-%m" : "%Y-%m-%d", date: "$orderDate" } },
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

        // 6. Predictions (Consistent seasonality logic)
        const avgDailySales = salesByDate.length > 0 ? totalRevenue / (period === 'year' ? 365 : (period === 'week' ? 7 : 30)) : 500;
        const baseline = avgDailySales > 0 ? avgDailySales : 500;
        const predictions = [];
        for (let i = 1; i <= 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            const dayOfWeek = date.getDay();
            const seasonality = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.2 : 0.9;
            const randomness = 0.9 + Math.random() * 0.2;
            
            predictions.push({
                date: date.toISOString().split('T')[0],
                sales: Math.round(baseline * seasonality * randomness)
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

exports.getGrowthData = async (req, res) => {
    try {
        const adminId = req.user.id;
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        const thisMonthRevenue = await Order.aggregate([
            { $match: { adminId, orderDate: { $gte: thisMonthStart }, status: { $ne: 'CANCELLED' } } },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]);

        const lastMonthRevenue = await Order.aggregate([
            { $match: { adminId, orderDate: { $gte: lastMonthStart, $lt: thisMonthStart }, status: { $ne: 'CANCELLED' } } },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]);

        const current = thisMonthRevenue.length > 0 ? thisMonthRevenue[0].total : 0;
        const previous = lastMonthRevenue.length > 0 ? lastMonthRevenue[0].total : 0;

        let percentage = 0;
        if (previous > 0) {
            percentage = ((current - previous) / previous) * 100;
        } else if (current > 0) {
            percentage = 100;
        }

        res.json({
            current,
            previous,
            percentage: Math.round(percentage),
            period: 'Month-over-Month'
        });
    } catch (err) {
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
    try {
        const adminId = req.user.id;
        
        // Calculate average daily sales from last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const salesStats = await Order.aggregate([
            { $match: { adminId, orderDate: { $gte: thirtyDaysAgo }, status: { $ne: 'CANCELLED' } } },
            { $group: { _id: null, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } }
        ]);
        
        const totalRev = salesStats.length > 0 ? salesStats[0].total : 0;
        const avgDailySales = totalRev / 30;
        const baseline = avgDailySales > 0 ? avgDailySales : 500; // Default to 500 if no history
        
        const predictions = [];
        for (let i = 1; i <= 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            
            // Simple trend: baseline with some day-of-week seasonality (weekends usually higher)
            const dayOfWeek = date.getDay();
            const seasonality = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.2 : 0.9;
            const randomness = 0.9 + Math.random() * 0.2;
            
            predictions.push({
                date: date.toISOString().split('T')[0],
                sales: Math.round(baseline * seasonality * randomness)
            });
        }
        res.json(predictions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


