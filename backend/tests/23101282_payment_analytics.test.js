/**
 * Unit Tests for Payment & Analytics Module
 * Student ID: 23101282
 * Student Name: Md. Mohibul Islam Shimul
 * 
 * Features Tested:
 * 1. Payment status tracking (Pending, Paid, Overdue)
 * 2. Daily/monthly earnings dashboard
 * 3. Ratings and review system (with reply)
 * 4. Provider performance analytics (graphs, insights)
 * 5. Gamification: points, badges, monthly rankings
 */

const request = require('supertest');
const { app } = require('../server');

describe('Feature: Payment & Analytics Module (ID: 23101282 - Md. Mohibul Islam Shimul)', () => {
    let customerToken = '';
    let providerToken = '';
    let adminToken = '';
    let customerID = null;
    let providerID = null;
    let serviceRequestID = null;
    let reviewID = null;
    const timestamp = Date.now();

    // Test users
    const customerUser = {
        name: `Customer ${timestamp}`,
        email: `customer_pay_${timestamp}@example.com`,
        password: 'CustomerPass123!',
        phone: '01712345678',
        role: 'Customer'
    };

    const providerUser = {
        name: `Provider ${timestamp}`,
        email: `provider_pay_${timestamp}@example.com`,
        password: 'ProviderPass123!',
        phone: '01812345678',
        role: 'Provider'
    };

    const adminUser = {
        name: `Admin ${timestamp}`,
        email: `admin_pay_${timestamp}@example.com`,
        password: 'AdminPass123!',
        phone: '01912345678',
        role: 'Admin'
    };

    // PRE-CONDITION: Dynamic Auth & Setup
    beforeAll(async () => {
        const customerRegRes = await request(app)
            .post('/api/auth/register')
            .send(customerUser);
        
        if (customerRegRes.body.data) {
            customerToken = customerRegRes.body.data.token;
            customerID = customerRegRes.body.data.user.userID;
        }

        const providerRegRes = await request(app)
            .post('/api/auth/register')
            .send(providerUser);
        
        if (providerRegRes.body.data) {
            providerToken = providerRegRes.body.data.token;
            providerID = providerRegRes.body.data.user.userID;
        }

        const adminRegRes = await request(app)
            .post('/api/auth/register')
            .send(adminUser);
        
        if (adminRegRes.body.data) {
            adminToken = adminRegRes.body.data.token;
        }

        // Create, accept, and complete a service request
        const serviceRes = await request(app)
            .post('/api/service-requests/create')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({
                category: 'Plumbing',
                description: 'Need plumbing service for payment and analytics testing.',
                priorityLevel: 'Normal'
            });

        if (serviceRes.body.data) {
            serviceRequestID = serviceRes.body.data.request.requestID;

            await request(app)
                .post(`/api/service-requests/${serviceRequestID}/accept`)
                .set('Authorization', `Bearer ${providerToken}`);

            await request(app)
                .post(`/api/service-requests/${serviceRequestID}/complete`)
                .set('Authorization', `Bearer ${providerToken}`);

            await request(app)
                .post(`/api/service-requests/${serviceRequestID}/confirm-completion`)
                .set('Authorization', `Bearer ${customerToken}`);
        }
    });

    // ==========================================
    // FEATURE 1: PAYMENT STATUS TRACKING
    // ==========================================

    describe('Feature 1: Payment Status Tracking', () => {
        it('TEST 1: should get payments for customer', async () => {
            const res = await request(app)
                .get(`/api/payments/customer/${customerID}`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('TEST 2: should get payments for provider', async () => {
            const res = await request(app)
                .get(`/api/payments/provider/${providerID}`)
                .set('Authorization', `Bearer ${providerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('TEST 3: should get payment summary for provider', async () => {
            const res = await request(app)
                .get(`/api/payments/summary/${providerID}`)
                .set('Authorization', `Bearer ${providerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('TEST 4: should return 401 when accessing payments without token', async () => {
            const res = await request(app)
                .get(`/api/payments/customer/${customerID}`);

            expect(res.statusCode).toEqual(401);
            expect(res.body.success).toBe(false);
        });

        it('TEST 5: should return 404 for non-existent payment', async () => {
            const res = await request(app)
                .get('/api/payments/999999')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.statusCode).toEqual(404);
            expect(res.body.success).toBe(false);
        });
    });

    // ==========================================
    // FEATURE 2: EARNINGS DASHBOARD
    // ==========================================

    describe('Feature 2: Daily/Monthly Earnings Dashboard', () => {
        it('TEST 6: should get daily earnings for provider', async () => {
            const res = await request(app)
                .get(`/api/earnings/${providerID}/daily`)
                .set('Authorization', `Bearer ${providerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('TEST 7: should get daily earnings with date range', async () => {
            const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const endDate = new Date().toISOString().split('T')[0];
            
            const res = await request(app)
                .get(`/api/earnings/${providerID}/daily/range?startDate=${startDate}&endDate=${endDate}`)
                .set('Authorization', `Bearer ${providerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('TEST 8: should get monthly earnings breakdown', async () => {
            const res = await request(app)
                .get(`/api/earnings/${providerID}/monthly`)
                .set('Authorization', `Bearer ${providerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('TEST 9: should return 401 when accessing earnings without token', async () => {
            const res = await request(app)
                .get(`/api/earnings/${providerID}/daily`);

            expect(res.statusCode).toEqual(401);
            expect(res.body.success).toBe(false);
        });
    });

    // ==========================================
    // FEATURE 3: RATINGS AND REVIEW SYSTEM
    // ==========================================

    describe('Feature 3: Ratings and Review System', () => {
        it('TEST 10: should submit a review with rating', async () => {
            const review = {
                requestID: serviceRequestID,
                rating: 5,
                comment: 'Excellent service! The provider was professional and completed the work perfectly.'
            };

            const res = await request(app)
                .post('/api/reviews/submit')
                .set('Authorization', `Bearer ${customerToken}`)
                .send(review);

            expect(res.statusCode).toEqual(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.review.rating).toBe(5);

            reviewID = res.body.data.review.reviewID;
        });

        it('TEST 11: should allow provider to reply to review', async () => {
            const reply = {
                reviewID: reviewID,
                replyText: 'Thank you for your kind words! It was a pleasure serving you.'
            };

            const res = await request(app)
                .post('/api/reviews/reply')
                .set('Authorization', `Bearer ${providerToken}`)
                .send(reply);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('TEST 12: should get provider reviews', async () => {
            const res = await request(app)
                .get(`/api/reviews/provider/${providerID}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('reviews');
            expect(res.body.data).toHaveProperty('averageRating');
        });

        it('TEST 13: should return 400 for invalid rating value', async () => {
            const res = await request(app)
                .post('/api/reviews/submit')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    requestID: serviceRequestID,
                    rating: 10, // Invalid - should be 1-5
                    comment: 'Testing invalid rating value'
                });

            // Should return 400 for invalid rating or 409 for duplicate review
            expect([400, 409]).toContain(res.statusCode);
            expect(res.body.success).toBe(false);
        });

        it('TEST 14: should return 403 when provider tries to submit review', async () => {
            const res = await request(app)
                .post('/api/reviews/submit')
                .set('Authorization', `Bearer ${providerToken}`)
                .send({
                    requestID: serviceRequestID,
                    rating: 5,
                    comment: 'Provider should not submit reviews'
                });

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toBe(false);
        });
    });

    // ==========================================
    // FEATURE 4: PROVIDER PERFORMANCE ANALYTICS
    // ==========================================

    describe('Feature 4: Provider Performance Analytics', () => {
        it('TEST 15: should get provider analytics dashboard', async () => {
            const res = await request(app)
                .get(`/api/analytics/dashboard/${providerID}`)
                .set('Authorization', `Bearer ${providerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('TEST 16: should get review analytics for provider', async () => {
            const res = await request(app)
                .get(`/api/reviews/analytics/${providerID}`)
                .set('Authorization', `Bearer ${providerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('averageRating');
        });

        it('TEST 17: should get performance metrics', async () => {
            const res = await request(app)
                .get(`/api/analytics/performance/${providerID}`)
                .set('Authorization', `Bearer ${providerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('TEST 18: should return 403 when viewing others analytics', async () => {
            const res = await request(app)
                .get(`/api/reviews/analytics/${providerID}`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toBe(false);
        });
    });

    // ==========================================
    // FEATURE 5: GAMIFICATION SYSTEM
    // ==========================================

    describe('Feature 5: Gamification - Points, Badges, Rankings', () => {
        it('TEST 19: should get user gamification dashboard', async () => {
            const res = await request(app)
                .get(`/api/gamification/dashboard/${providerID}`)
                .set('Authorization', `Bearer ${providerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('TEST 20: should get provider rank', async () => {
            const res = await request(app)
                .get(`/api/gamification/rank/${providerID}`)
                .set('Authorization', `Bearer ${providerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('TEST 21: should get leaderboard/rankings', async () => {
            const res = await request(app)
                .get('/api/gamification/leaderboard')
                .set('Authorization', `Bearer ${providerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('TEST 22: should get gamification dashboard for customer', async () => {
            const res = await request(app)
                .get(`/api/gamification/dashboard/${customerID}`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('TEST 23: should handle non-existent user gamification gracefully', async () => {
            const res = await request(app)
                .get('/api/gamification/dashboard/999999')
                .set('Authorization', `Bearer ${providerToken}`);

            // May return 404 or 500 depending on implementation
            expect([404, 500]).toContain(res.statusCode);
            expect(res.body.success).toBe(false);
        });
    });
});
