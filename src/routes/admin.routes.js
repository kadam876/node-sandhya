const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middleware/auth');
const authorize = require('../middleware/authorize');

router.use(authMiddleware);

router.get('/dashboard', adminController.getDashboard);
router.get('/inventory', adminController.getInventory);
router.get('/info', adminController.getAdminInfo);
router.get('/my-users', adminController.getMyUsers);
router.get('/catalogues', adminController.getCatalogues);
router.get('/orders', adminController.getOrders);

router.post('/products', adminController.addProduct);
router.put('/products/:id', adminController.updateProduct);
router.delete('/products/:id', adminController.deleteProduct);

router.put('/orders/:id/status', adminController.updateOrderStatus);

// --- Platform Owner (OWNER) Routes ---
router.get('/platform-stats', authorize('OWNER'), adminController.getPlatformStats);
router.get('/platform-sales-growth', authorize('OWNER'), adminController.getPlatformSalesGrowth);
router.get('/shops', authorize('OWNER'), adminController.getAllShops);
router.post('/shops/:id/verify', authorize('OWNER'), adminController.verifyShopStatus);

module.exports = router;
