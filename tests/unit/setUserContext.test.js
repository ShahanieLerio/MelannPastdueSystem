const { setUserContext } = require('../../src/middleware/setUserContext');
const db = require('../../src/db');

jest.mock('../../src/db');

describe('Set User Context Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = { user: null };
        res = {};
        next = jest.fn();
        jest.clearAllMocks();
    });

    it('should call next() directly if no user or userId is in req', () => {
        setUserContext(req, res, next);
        expect(db.query).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
    });

    it('should attempt to set config if user and userId are present', async () => {
        req.user = { userId: 'test-uuid' };
        db.query.mockResolvedValue({ rows: [] });

        setUserContext(req, res, next);

        // Wait for promise resolution
        await new Promise(process.nextTick);

        expect(db.query).toHaveBeenCalledWith("SELECT set_config('app.current_user', $1, true)", ['test-uuid']);
        expect(next).toHaveBeenCalled();
    });

    it('should call next(err) if db query fails', async () => {
        req.user = { userId: 'test-uuid' };
        const testError = new Error('DB Error');
        db.query.mockRejectedValue(testError);

        setUserContext(req, res, next);

        await new Promise(process.nextTick);

        expect(next).toHaveBeenCalledWith(testError);
    });
});
