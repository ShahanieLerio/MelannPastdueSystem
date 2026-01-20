const { checkRole } = require('../../src/middleware/roleCheck');

describe('Role Check Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = { user: null };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
    });

    it('should return 401 if user is not attached to req', () => {
        const middleware = checkRole(['admin']);
        middleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Unauthenticated' });
    });

    it('should return 403 if user role is not allowed', () => {
        req.user = { role: 'collector' };
        const middleware = checkRole(['admin', 'supervisor']);
        middleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
    });

    it('should call next if user role is allowed', () => {
        req.user = { role: 'admin' };
        const middleware = checkRole(['admin', 'supervisor']);
        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });
});
