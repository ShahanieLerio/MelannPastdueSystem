const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');

// POST /api/auth/login
router.post('/login', authController.login);
// POST /api/auth/register
router.post('/register', authController.register);

// GET /api/auth/collectors
router.get('/collectors', authController.listCollectors);

// Protected Admin routes for approval
router.get('/pending-users', verifyToken, checkRole(['admin']), authController.listPendingUsers);
router.put('/users/:id/approve', verifyToken, checkRole(['admin']), authController.approveUser);

// Protected collector management
router.post('/collectors', verifyToken, checkRole(['admin', 'supervisor']), authController.createCollector);
router.put('/collectors/:id', verifyToken, checkRole(['admin', 'supervisor']), authController.updateCollector);
router.delete('/collectors/:id', verifyToken, checkRole(['admin']), authController.deleteCollector);

module.exports = router;
