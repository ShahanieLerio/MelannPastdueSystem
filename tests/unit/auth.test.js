const { verifyToken } = require('../../src/middleware/auth');
const jwt = require('jsonwebtoken');

jest.mock('jsonwebtoken');

describe('Auth Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = { headers: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
    });

    it('should return 401 if no token is provided', () => {
        verifyToken(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Access token missing' });
    });

    it('should return 403 if token is invalid', () => {
        req.headers['authorization'] = 'Bearer invalidtoken';
        jwt.verify.mockImplementation((token, secret, cb) => cb(new Error('Invalid'), null));

        verifyToken(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    });

    it('should call next() and attach user if token is valid', () => {
        const userPayload = { userId: '123', role: 'admin' };
        req.headers['authorization'] = 'Bearer validtoken';
        jwt.verify.mockImplementation((token, secret, cb) => cb(null, userPayload));

        verifyToken(req, res, next);
        expect(req.user).toEqual(userPayload);
        expect(next).toHaveBeenCalled();
    });
});
