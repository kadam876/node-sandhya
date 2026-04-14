const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.post('/', orderController.createOrder);
router.get('/my-orders', orderController.getMyOrders);

module.exports = router;
