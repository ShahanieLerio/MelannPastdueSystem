// src/routes/reports.js
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { checkRole } = require('../middleware/roleCheck');

// Both reports accessible by Admin and Supervisor
router.get('/aging', checkRole(['admin', 'supervisor']), reportController.getAgingReport);
router.get('/performance', checkRole(['admin', 'supervisor']), reportController.getCollectorPerformance);
router.get('/masterlist', checkRole(['admin', 'supervisor']), reportController.getMasterlist);
router.get('/monthly', checkRole(['admin', 'supervisor']), reportController.getMonthlyReport);
router.get('/collection-summary', checkRole(['admin', 'supervisor']), reportController.getCollectionSummary);

// Cross-controller access
const loanController = require('../controllers/loanController');

router.get('/client-updates', checkRole(['admin', 'supervisor', 'collector']), loanController.getClientUpdates);
router.get('/notifications', checkRole(['admin', 'supervisor', 'collector']), loanController.getNotifications);

module.exports = router;
