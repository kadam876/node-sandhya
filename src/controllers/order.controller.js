const Order = require('../models/Order');

exports.createOrder = async (req, res) => {
    try {
        const { items, orderType, shippingAddress, paymentMethod } = req.body;
        
        let totalAmount = 0;
        const processedItems = items.map(item => {
            const unitPrice = item.unitPrice || 0;
            const quantity = item.quantity || 1;
            const totalPrice = unitPrice * quantity;
            totalAmount += totalPrice;

            return {
                ...item,
                unitPrice,
                totalPrice,
                quantity
            };
        });

        const newOrder = new Order({
            userId: req.user.id,
            items: processedItems,
            totalAmount,
            shippingAddress,
            paymentMethod,
            orderType: orderType || 'RETAIL',
            status: 'PENDING'
        });

        await newOrder.save();
        res.status(201).json(newOrder.toJSON());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.user.id }).sort({ orderDate: -1 });
        res.json(orders.map(o => o.toJSON()));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
