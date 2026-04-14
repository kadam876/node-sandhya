const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shop.controller');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);
router.post('/setup', shopController.setupShop);
router.post('/', shopController.registerShop);
router.get('/', shopController.getShops);

module.exports = router;
