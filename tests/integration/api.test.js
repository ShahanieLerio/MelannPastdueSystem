const request = require('supertest');
const app = require('../../src/app');

describe('API Integration Tests', () => {
    describe('GET /api/health', () => {
        it('should return 200 and status ok', async () => {
            const res = await request(app).get('/api/health');
            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({ status: 'ok' });
        });
    });

    describe('Protected Routes', () => {
        it('should return 401 for /api/loans without token', async () => {
            const res = await request(app).get('/api/loans');
            expect(res.statusCode).toEqual(401);
        });
    });
});
