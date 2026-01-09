/**
 * Unit Tests for Request Handling & Scheduling
 * Student ID: 23101040
 * Student Name: Anamika Sarker Arni
 * 
 * Features Tested:
 * 1. Provider can accept/reject requests
 * 2. Manual booking system for preferred provider
 * 3. Real-time service status tracking (Pending → Ongoing → Completed)
 * 4. Emergency / Priority Service Requests
 * 5. Service Bundle / Package Offers
 */

const request = require('supertest');
const { app } = require('../server');

describe('Feature: Request Handling & Scheduling (ID: 23101040 - Anamika Sarker Arni)', () => {
    let customerToken = '';
    let providerToken = '';
    let customerID = null;
    let providerID = null;
    let serviceRequestID = null;
    const timestamp = Date.now();

    // Test users
    const customerUser = {
        name: `Customer ${timestamp}`,
        email: `customer_rh_${timestamp}@example.com`,
        password: 'CustomerPass123!',
        phone: '01712345678',
        role: 'Customer'
    };

    const providerUser = {
        name: `Provider ${timestamp}`,
        email: `provider_rh_${timestamp}@example.com`,
        password: 'ProviderPass123!',
        phone: '01812345678',
        role: 'Provider'
    };

    // PRE-CONDITION: Dynamic Auth
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

        // Create a service request for testing
        const serviceRes = await request(app)
            .post('/api/service-requests/create')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({
                category: 'Plumbing',
                description: 'Need plumbing service for request handling tests.',
                priorityLevel: 'Normal'
            });

        if (serviceRes.body.data) {
            serviceRequestID = serviceRes.body.data.request.requestID;
        }
    });

    // ==========================================
    // FEATURE 1: PROVIDER ACCEPT/REJECT REQUESTS
    // ==========================================

    describe('Feature 1: Provider Accept/Reject Requests', () => {
        let acceptRejectRequestID = null;

        beforeAll(async () => {
            const createRes = await request(app)
                .post('/api/service-requests/create')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    category: 'Electrical',
                    description: 'Need electrical service for accept/reject testing.',
                    priorityLevel: 'Normal'
                });
            
            acceptRejectRequestID = createRes.body.data?.request?.requestID;
        });

        it('TEST 1: should allow provider to accept a pending request', async () => {
            const res = await request(app)
                .post(`/api/service-requests/${acceptRejectRequestID}/accept`)
                .set('Authorization', `Bearer ${providerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Service request accepted successfully');
        });

        it('TEST 2: should return 400 when accepting already accepted request', async () => {
            const res = await request(app)
                .post(`/api/service-requests/${acceptRejectRequestID}/accept`)
                .set('Authorization', `Bearer ${providerToken}`);

            expect(res.statusCode).toEqual(400);
            expect(res.body.success).toBe(false);
        });

        it('TEST 3: should allow provider to reject a pending request', async () => {
            // Create new request for rejection
            const createRes = await request(app)
                .post('/api/service-requests/create')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    category: 'Cleaning',
                    description: 'Need cleaning service for rejection testing.',
                    priorityLevel: 'Normal'
                });

            const rejectRequestID = createRes.body.data?.request?.requestID;

            const res = await request(app)
                .post(`/api/service-requests/${rejectRequestID}/reject`)
                .set('Authorization', `Bearer ${providerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('TEST 4: should return 404 when accepting non-existent request', async () => {
            const res = await request(app)
                .post('/api/service-requests/999999/accept')
                .set('Authorization', `Bearer ${providerToken}`);

            expect(res.statusCode).toEqual(404);
            expect(res.body.success).toBe(false);
        });

        it('TEST 5: should return 403 when customer tries to accept request', async () => {
            const res = await request(app)
                .post(`/api/service-requests/${serviceRequestID}/accept`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toBe(false);
        });
    });

    // ==========================================
    // FEATURE 2: MANUAL BOOKING SYSTEM
    // ==========================================

    describe('Feature 2: Manual Booking System', () => {
        it('TEST 6: should create manual booking for preferred provider', async () => {
            const booking = {
                providerID: providerID,
                category: 'Plumbing',
                description: 'Manual booking for preferred plumber - need pipe repair.',
                scheduledDate: new Date(Date.now() + 172800000).toISOString().split('T')[0],
                scheduledTime: '10:00-11:00',
                priorityLevel: 'Normal'
            };

            const res = await request(app)
                .post('/api/manual-booking/create')
                .set('Authorization', `Bearer ${customerToken}`)
                .send(booking);

            expect(res.statusCode).toEqual(201);
            expect(res.body.success).toBe(true);
        });

        it('TEST 7: should return 400 if required fields are missing in manual booking', async () => {
            const res = await request(app)
                .post('/api/manual-booking/create')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    category: 'Plumbing',
                    description: 'Manual booking without provider ID and date.'
                });

            expect(res.statusCode).toEqual(400);
            expect(res.body.success).toBe(false);
        });

        it('TEST 8: should return 401 when creating manual booking without token', async () => {
            const res = await request(app)
                .post('/api/manual-booking/create')
                .send({
                    providerID: providerID,
                    category: 'Plumbing',
                    description: 'Unauthorized manual booking attempt.',
                    scheduledDate: new Date(Date.now() + 172800000).toISOString().split('T')[0]
                });

            expect(res.statusCode).toEqual(401);
            expect(res.body.success).toBe(false);
        });
    });

    // ==========================================
    // FEATURE 3: REAL-TIME STATUS TRACKING
    // ==========================================

    describe('Feature 3: Real-time Service Status Tracking', () => {
        let statusTrackingRequestID = null;

        beforeAll(async () => {
            const createRes = await request(app)
                .post('/api/service-requests/create')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    category: 'Electrical',
                    description: 'Service request for status tracking testing.',
                    priorityLevel: 'Normal'
                });

            statusTrackingRequestID = createRes.body.data?.request?.requestID;

            // Accept the request
            await request(app)
                .post(`/api/service-requests/${statusTrackingRequestID}/accept`)
                .set('Authorization', `Bearer ${providerToken}`);
        });

        it('TEST 9: should track status as Accepted after provider accepts', async () => {
            const res = await request(app)
                .get(`/api/service-requests/${statusTrackingRequestID}`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.request.status).toBe('Accepted');
        });

        it('TEST 10: should allow provider to start service (Accepted → Ongoing)', async () => {
            const res = await request(app)
                .post(`/api/service-requests/${statusTrackingRequestID}/start`)
                .set('Authorization', `Bearer ${providerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('TEST 11: should track status as Ongoing after service starts', async () => {
            const res = await request(app)
                .get(`/api/service-requests/${statusTrackingRequestID}`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.request.status).toBe('Ongoing');
        });

        it('TEST 12: should return 403 when customer tries to start service', async () => {
            const res = await request(app)
                .post(`/api/service-requests/${statusTrackingRequestID}/start`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toBe(false);
        });
    });

    // ==========================================
    // FEATURE 4: EMERGENCY/PRIORITY REQUESTS
    // ==========================================

    describe('Feature 4: Emergency/Priority Service Requests', () => {
        it('TEST 13: should create Emergency priority request', async () => {
            const res = await request(app)
                .post('/api/service-requests/create')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    category: 'Plumbing',
                    description: 'URGENT: Burst pipe flooding the house! Need immediate help!',
                    priorityLevel: 'Emergency'
                });

            expect(res.statusCode).toEqual(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.request.priorityLevel).toBe('Emergency');
        });

        it('TEST 14: should create High priority request', async () => {
            const res = await request(app)
                .post('/api/service-requests/create')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    category: 'Electrical',
                    description: 'Power outlet sparking - needs urgent attention.',
                    priorityLevel: 'High'
                });

            expect(res.statusCode).toEqual(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.request.priorityLevel).toBe('High');
        });

        it('TEST 15: should default to Normal priority if not specified', async () => {
            const res = await request(app)
                .post('/api/service-requests/create')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    category: 'Cleaning',
                    description: 'Regular house cleaning service needed.'
                });

            expect(res.statusCode).toEqual(201);
            expect(res.body.data.request.priorityLevel).toBe('Normal');
        });
    });

    // ==========================================
    // FEATURE 5: SERVICE BUNDLES/PACKAGES
    // ==========================================

    describe('Feature 5: Service Bundle/Package Offers', () => {
        let bundleID = null;

        it('TEST 16: should create a service bundle (Provider)', async () => {
            const bundle = {
                bundleName: 'Complete Home Maintenance Package',
                description: 'Includes plumbing check, electrical inspection, and cleaning.',
                servicesIncluded: ['Plumbing', 'Electrical', 'Cleaning'],
                price: 5000
            };

            const res = await request(app)
                .post('/api/bundles/create')
                .set('Authorization', `Bearer ${providerToken}`)
                .send(bundle);

            expect(res.statusCode).toEqual(201);
            expect(res.body.success).toBe(true);
            
            bundleID = res.body.data?.bundle?.bundleID || res.body.data?.bundleID;
        });

        it('TEST 17: should get all available bundles', async () => {
            const res = await request(app)
                .get('/api/bundles/browse')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('TEST 18: should get bundle by ID', async () => {
            if (!bundleID) return;

            const res = await request(app)
                .get(`/api/bundles/${bundleID}`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('TEST 19: should return 401 when creating bundle without token', async () => {
            const res = await request(app)
                .post('/api/bundles/create')
                .send({
                    name: 'Unauthorized Bundle',
                    description: 'This should fail.',
                    price: 1000
                });

            expect(res.statusCode).toEqual(401);
            expect(res.body.success).toBe(false);
        });
    });
});
