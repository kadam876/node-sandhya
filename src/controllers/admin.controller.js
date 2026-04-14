const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Shop = require('../models/Shop');
const { createClient } = require('@supabase/supabase-js');

// Only instantiate client if keys are present (prevents server crash before you configure .env)
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

const uploadImageToSupabase = async (base64String) => {
    if (!base64String.startsWith('data:image/')) return base64String;

    const matches = base64String.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) throw new Error('Invalid base64 string provided');

    let mimeType = matches[1];
    let buffer = Buffer.from(matches[2], 'base64');

    // Convert unsupported formats (AVIF, WEBP, etc.) to JPEG for universal compatibility
    const SUPPORTED = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!SUPPORTED.includes(mimeType)) {
        try {
            const sharp = require('sharp');
            console.log(`[Upload] Converting ${mimeType} → image/jpeg`);
            buffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
            mimeType = 'image/jpeg';
        } catch (sharpErr) {
            console.warn(`[Upload] Skipping conversion, sharp not available natively on this OS:`, sharpErr.message);
        }
    }

    const extension = mimeType.split('/')[1] || 'jpg';
    const fileName = `products/${Date.now()}-${Math.floor(Math.random() * 10000)}.${extension}`;
    const bucket = process.env.SUPABASE_BUCKET || 'sandhya-images';

    const { error } = await supabase.storage.from(bucket).upload(fileName, buffer, {
        contentType: mimeType,
        upsert: false
    });

    if (error) throw new Error(`Supabase upload failed: ${error.message}`);

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return publicUrlData.publicUrl;
};

exports.getDashboard = async (req, res) => {
    res.json({ message: "Admin dashboard mapped" });
};

exports.addProduct = async (req, res) => {
    try {
        let payload = { ...req.body, adminId: req.user.id };
        if (payload.imageUrl && payload.imageUrl.startsWith('data:image/')) {
            payload.imageUrl = await uploadImageToSupabase(payload.imageUrl);
        }

        const product = new Product(payload);
        await product.save();
        res.status(201).json(product.toJSON());
    } catch (err) {
        console.error("ADMIN ADD PRODUCT CRASH:", err);
        res.status(500).json({ error: err.message });
    }
};

exports.getInventory = async (req, res) => {
    try {
        const products = await Product.find({ adminId: req.user.id });
        const inventory = products.map(p => ({
            id: p._id.toString(),
            name: p.name,
            category: p.category,
            price: p.price,
            stockQuantity: p.stockQuantity,
            imageUrl: p.imageUrl,
            isActive: p.isActive
        }));
        res.json(inventory);
    } catch (err) {
        console.error("ADMIN INVENTORY FETCH CRASH:", err);
        res.status(500).json({ error: err.message });
    }
};

exports.getAdminInfo = async (req, res) => {
    res.json({
        message: "Welcome to Admin Panel",
        adminName: req.user.name || "Admin User",
        permissions: ["MANAGE_PRODUCTS", "MANAGE_ORDERS", "VIEW_ANALYTICS", "MANAGE_USERS"],
        dashboard: "/api/admin/dashboard",
        inventory: "/api/admin/inventory",
        orders: "/api/admin/orders",
        users: "/api/admin/my-users"
    });
};

exports.getMyUsers = async (req, res) => {
    res.json([]);
};

exports.getCatalogues = async (req, res) => {
    res.json([]); // Simple stub to prevent 404
};

exports.updateProduct = async (req, res) => {
    try {
        let payload = { ...req.body };
        if (payload.imageUrl && payload.imageUrl.startsWith('data:image/')) {
            payload.imageUrl = await uploadImageToSupabase(payload.imageUrl);
        }

        const product = await Product.findOneAndUpdate(
            { _id: req.params.id, adminId: req.user.id },
            payload,
            { new: true }
        );
        if (!product) return res.status(404).json({ error: 'Product not found or unauthorized' });
        res.json(product.toJSON());
    } catch (err) {
        console.error("ADMIN UPDATE PRODUCT CRASH:", err);
        res.status(500).json({ error: err.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        await Product.findOneAndDelete({ _id: req.params.id, adminId: req.query.adminId });
        res.sendStatus(204);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getOrders = async (req, res) => {
    try {
        const orders = await Order.find({ adminId: req.query.adminId });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const order = await Order.findOneAndUpdate(
            { _id: req.params.id, adminId: req.query.adminId },
            { status: req.query.status },
            { new: true }
        );
        res.json(order.toJSON());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- Platform Owner (OWNER) Methods ---

exports.getPlatformStats = async (req, res) => {
    try {
        const totalShops = await User.countDocuments({ role: 'SHOP_OWNER' });
        const totalUsers = await User.countDocuments({ role: 'CUSTOMER' });
        const totalOrders = await Order.countDocuments({});

        const revenueResult = await Order.aggregate([
            { $match: { status: { $in: ['PAID', 'DELIVERED', 'SHIPPED'] } } },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]);
        const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

        // Calculate real growth (this month vs last month)
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        
        const thisMonthRevenue = await Order.aggregate([
            { $match: { orderDate: { $gte: thisMonthStart }, status: { $in: ['PAID', 'DELIVERED', 'SHIPPED'] } } },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]);
        
        const lastMonthRevenue = await Order.aggregate([
            { $match: { orderDate: { $gte: lastMonthStart, $lt: thisMonthStart }, status: { $in: ['PAID', 'DELIVERED', 'SHIPPED'] } } },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]);

        const currentRev = thisMonthRevenue.length > 0 ? thisMonthRevenue[0].total : 0;
        const previousRev = lastMonthRevenue.length > 0 ? lastMonthRevenue[0].total : 0;
        
        let growth = 0;
        if (previousRev > 0) {
            growth = ((currentRev - previousRev) / previousRev) * 100;
        } else if (currentRev > 0) {
            growth = 100; // 100% growth if we had nothing last month
        }
        
        res.json({
            totalShops,
            totalUsers,
            totalOrders,
            totalRevenue,
            platformGrowth: Math.round(growth)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getAllShops = async (req, res) => {
    try {
        // Find all shop registrations from the Shop model
        const shops = await Shop.find({}).sort({ createdAt: -1 });

        // Enrich with user email/name from User model to be safe
        const enrichedShops = await Promise.all(shops.map(async (shop) => {
            const user = await User.findById(shop.ownerId);
            const shopObj = shop.toJSON();
            return {
                ...shopObj,
                name: user ? user.name : 'Unknown Owner',
                email: shop.ownerEmail || (user ? user.email : 'No Email'),
                verified: shop.status === 'APPROVED' || (user ? user.isVerified : false)
            };
        }));

        res.json(enrichedShops);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.verifyShopStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.query; // true or false string from frontend

        const isApproved = status === 'true';
        const shopStatus = isApproved ? 'APPROVED' : 'REJECTED';

        const shop = await Shop.findByIdAndUpdate(id, { status: shopStatus }, { new: true });
        if (!shop) return res.status(404).json({ message: 'Shop application not found' });

        // Sync with User verification status
        await User.findByIdAndUpdate(shop.ownerId, { isVerified: isApproved });

        res.json({ success: true, message: `Shop ${shopStatus.toLowerCase()} successfully`, shop });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getPlatformSalesGrowth = async (req, res) => {
    try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const growth = await Order.aggregate([
            { $match: { orderDate: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m", date: "$orderDate" } },
                    revenue: { $sum: "$totalAmount" },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } },
            {
                $project: {
                    _id: 0,
                    month: "$_id",
                    revenue: 1,
                    orders: "$orderCount"
                }
            }
        ]);

        // Map YYYY-MM to Month Name
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const formattedGrowth = growth.map(item => {
            const [year, month] = item.month.split('-');
            return {
                ...item,
                month: monthNames[parseInt(month) - 1]
            };
        });

        res.json(formattedGrowth);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getPlatformOnboarding = async (req, res) => {
    try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const onboarding = await User.aggregate([
            { $match: { role: 'SHOP_OWNER', createdAt: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                    partners: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } },
            { $project: { _id: 0, month: "$_id", partners: 1 } }
        ]);

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const formattedOnboarding = onboarding.map(item => {
            const [year, month] = item.month.split('-');
            return {
                ...item,
                month: monthNames[parseInt(month) - 1]
            };
        });

        res.json(formattedOnboarding);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getPlatformOrders = async (req, res) => {
    try {
        const orders = await Order.find({}).sort({ orderDate: -1 }).limit(100);
        
        const enrichedOrders = await Promise.all(orders.map(async (order) => {
            const shopOwner = await User.findById(order.adminId);
            const customer = await User.findById(order.userId);
            const orderObj = order.toJSON();
            return {
                ...orderObj,
                shopName: shopOwner ? shopOwner.shopName : 'Direct Sale',
                customerName: customer ? customer.name : 'Guest Customer',
                customerEmail: customer ? customer.email : order.userId
            };
        }));

        res.json(enrichedOrders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getPlatformInventory = async (req, res) => {
    try {
        const products = await Product.find({}).sort({ adminId: 1 }).limit(200);
        
        const enrichedProducts = await Promise.all(products.map(async (product) => {
            const shopOwner = await User.findById(product.adminId);
            const productObj = product.toJSON();
            return {
                ...productObj,
                shopName: shopOwner ? shopOwner.shopName : 'Platform Stock'
            };
        }));

        res.json(enrichedProducts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteShopRequest = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[Admin] Deleting shop request: ${id}`);
        
        const shop = await Shop.findById(id);
        if (!shop) {
            console.warn(`[Admin] Shop ${id} not found`);
            return res.status(404).json({ message: 'Shop application not found' });
        }

        console.log(`[Admin] Found shop, ownerId: ${shop.ownerId}. Deleting owner...`);

        // Delete the associated user as well to clean up the DB
        if (shop.ownerId) {
            await User.findByIdAndDelete(shop.ownerId);
            // Delete the products associated with this shop (if any)
            await Product.deleteMany({ adminId: shop.ownerId });
        }
        
        // Finally delete the shop record
        await Shop.findByIdAndDelete(id);

        console.log(`[Admin] Shop ${id} deleted successfully`);
        res.json({ success: true, message: 'Shop request and associated account deleted successfully' });
    } catch (err) {
        console.error(`[Admin] Shop deletion CRASH for ${req.params.id}:`, err);
        res.status(500).json({ error: err.message });
    }
};
