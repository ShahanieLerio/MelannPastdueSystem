const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');
const { checkRole } = require('../middleware/roleCheck');

// GET /api/loans - list with optional filters (admin & supervisor can view all, collector can view own)
router.get('/',
    // role check: collectors can still list but will see only their own loans (handled in controller)
    checkRole(['admin', 'supervisor', 'collector']),
    loanController.listLoans
);

// GET /api/loans/:id - get single loan (restricted to same roles)
router.get('/:id',
    checkRole(['admin', 'supervisor', 'collector']),
    loanController.getLoan
);

// GET /api/loans/:id/history - get loan history (restricted to admin & supervisor)
router.get('/:id/history',
    checkRole(['admin', 'supervisor']),
    loanController.getLoanHistory
);

// POST /api/loans - create new loan (admin & supervisor only)
router.post('/',
    checkRole(['admin', 'supervisor']),
    loanController.createLoan
);

// PUT /api/loans/:id - update existing loan (admin & supervisor can edit any field, collector can only update amount_collected)
router.put('/:id',
    checkRole(['admin', 'supervisor', 'collector']),
    loanController.updateLoan
);

// DELETE /api/loans/:id - delete loan (admin only)
router.delete('/:id',
    checkRole(['admin']),
    loanController.deleteLoan
);

// Payment Routes
router.get('/:id/payments',
    checkRole(['admin', 'supervisor', 'collector']),
    loanController.getPaymentHistory
);

router.post('/:id/payments',
    checkRole(['admin', 'supervisor', 'collector']),
    loanController.addPayment
);

// Remarks Routes
router.get('/:id/remarks',
    checkRole(['admin', 'supervisor', 'collector']),
    loanController.getRemarks
);

router.post('/:id/remarks',
    checkRole(['admin', 'supervisor', 'collector']),
    loanController.addRemark
);

module.exports = router;
