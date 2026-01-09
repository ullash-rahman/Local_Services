/**
 * Unit Tests for Communication & History Features
 * Student ID: 23101372
 * Student Name: Mahbubur Rahman Ullash
 * 
 * Features Tested:
 * 1. In-app chat between user and provider
 * 2. Notifications for job updates
 * 3. Complaint submission and resolution system
 * 4. Maintenance reminders for repeat services
 * 5. Service history / job logs
 */

const request = require('supertest');
const { app } = require('../server');

describe('Feature: Communication & History (ID: 23101372 - Mahbubur Rahman Ullash)', () => {
    let customerToken = '';
    let providerToken = '';
    let adminToken = '';
    let customerID = null;
    let providerID = null;
    let serviceRequestID = null;
    let complaintID = null;
    const timestamp = Date.now();

    // Test users
    const customerUser = {
        name: `Customer ${timestamp}`,
        email: `customer_comm_${timestamp}@example.com`,
        password: 'CustomerPass123!',
        phone: '01712345678',
        role: 'Customer'
    };

    const providerUser = {
        name: `Provider ${timestamp}`,
        email: `provider_comm_${timestamp}@example.com`,
        password: 'ProviderPass123!',
        phone: '01812345678',
        role: 'Provider'
    };

    const adminUser = {
        name: `Admin ${timestamp}`,
        email: `admin_comm_${timestamp}@example.com`,
        password: 'AdminPass123!',
        phone: '01912345678',
        role: 'Admin'
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

        const adminRegRes = await request(app)
            .post('/api/auth/register')
            .send(adminUser);
        
        if (adminRegRes.body.data) {
            adminToken = adminRegRes.body.data.token;
        }

        // Create and accept a service request
        const serviceRes = await request(app)
            .post('/api/service-requests/create')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({
                category: 'Plumbing',
                description: 'Need plumbing service for communication testing.',
                priorityLevel: 'Normal'
            });

        if (serviceRes.body.data) {
            serviceRequestID = serviceRes.body.data.request.requestID;

            await request(app)
                .post(`/api/service-requests/${serviceRequestID}/accept`)
                .set('Authorization', `Bearer ${providerToken}`);
        }
    });

    // ==========================================
    // FEATURE 1: IN-APP CHAT
    // ==========================================

    describe('Feature 1: In-app Chat', () => {
        it('TEST 1: should send a chat message', async () => {
            const message = {
                requestID: serviceRequestID,
                receiverID: providerID,
                messageText: 'Hello, when can you come to fix the pipe?'
            };

            const res = await request(app)
                .post('/api/chat/send')
                .set('Authorization', `Bearer ${customerToken}`)
                .send(message);

            expect(res.statusCode).toEqual(201);
            expect(res.body.success).toBe(true);
        });

        it('TEST 2: should get chat messages for a request', async () => {
            const res = await request(app)
                .get(`/api/chat/messages/${serviceRequestID}`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            // Response data is an array of messages directly
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('TEST 3: should return 400 if message text is missing', async () => {
            const res = await request(app)
                .post('/api/chat/send')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    requestID: serviceRequestID,
                    receiverID: providerID
                });

            expect(res.statusCode).toEqual(400);
            expect(res.body.success).toBe(false);
        });

        it('TEST 4: should return 401 when sending message without token', async () => {
            const res = await request(app)
                .post('/api/chat/send')
                .send({
                    requestID: serviceRequestID,
                    receiverID: providerID,
                    messageText: 'Unauthorized message'
                });

            expect(res.statusCode).toEqual(401);
            expect(res.body.success).toBe(false);
        });
    });

    // ==========================================
    // FEATURE 2: NOTIFICATIONS
    // ==========================================

    describe('Feature 2: Notifications for Job Updates', () => {
        it('TEST 5: should get user notifications', async () => {
            const res = await request(app)
                .get('/api/notifications')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('notifications');
        });

        it('TEST 6: should get unread notification count', async () => {
            const res = await request(app)
                .get('/api/notifications/unread/count')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('unreadCount');
        });

        it('TEST 7: should mark all notifications as read', async () => {
            const res = await request(app)
                .put('/api/notifications/read/all')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('TEST 8: should return 401 when accessing notifications without token', async () => {
            const res = await request(app)
                .get('/api/notifications');

            expect(res.statusCode).toEqual(401);
            expect(res.body.success).toBe(false);
        });
    });

    // ==========================================
    // FEATURE 3: COMPLAINT SYSTEM
    // ==========================================

    describe('Feature 3: Complaint Submission and Resolution', () => {
        it('TEST 9: should submit a complaint', async () => {
            const complaint = {
                requestID: serviceRequestID,
                description: 'The service provider was late and did not complete the work properly.'
            };

            const res = await request(app)
                .post('/api/complaints/submit')
                .set('Authorization', `Bearer ${customerToken}`)
                .send(complaint);

            expect(res.statusCode).toEqual(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('complaintID');

            complaintID = res.body.data.complaintID;
        });

        it('TEST 10: should get my complaints', async () => {
            const res = await request(app)
                .get('/api/complaints/my-complaints')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('TEST 11: should get complaint by ID', async () => {
            const res = await request(app)
                .get(`/api/complaints/${complaintID}`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('TEST 12: should allow admin to update complaint status', async () => {
            const res = await request(app)
                .put(`/api/complaints/${complaintID}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    status: 'Under Review',
                    resolutionNotes: 'Investigating the complaint.'
                });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('TEST 13: should return 400 if complaint description is missing', async () => {
            const res = await request(app)
                .post('/api/complaints/submit')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    requestID: serviceRequestID
                });

            expect(res.statusCode).toEqual(400);
            expect(res.body.success).toBe(false);
        });

        it('TEST 14: should return 403 when non-admin tries to update status', async () => {
            const res = await request(app)
                .put(`/api/complaints/${complaintID}/status`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    status: 'Resolved'
                });

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toBe(false);
        });
    });

    // ==========================================
    // FEATURE 4: MAINTENANCE REMINDERS
    // ==========================================

    describe('Feature 4: Maintenance Reminders', () => {
        it('TEST 15: should create a maintenance reminder', async () => {
            const reminder = {
                serviceType: 'Plumbing',
                lastServiceDate: new Date().toISOString().split('T')[0],
                nextServiceDate: new Date(Date.now() + 2592000000).toISOString().split('T')[0], // 30 days
                reminderFrequency: 30
            };

            const res = await request(app)
                .post('/api/maintenance')
                .set('Authorization', `Bearer ${customerToken}`)
                .send(reminder);

            expect([200, 201]).toContain(res.statusCode);
            expect(res.body.success).toBe(true);
        });

        it('TEST 16: should get maintenance reminders', async () => {
            const res = await request(app)
                .get('/api/maintenance')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('TEST 17: should return 401 when accessing reminders without token', async () => {
            const res = await request(app)
                .get('/api/maintenance');

            expect(res.statusCode).toEqual(401);
            expect(res.body.success).toBe(false);
        });
    });

    // ==========================================
    // FEATURE 5: SERVICE HISTORY / JOB LOGS
    // ==========================================

    describe('Feature 5: Service History / Job Logs', () => {
        it('TEST 18: should get service history for customer', async () => {
            const res = await request(app)
                .get('/api/history')
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('TEST 19: should get service history for provider', async () => {
            const res = await request(app)
                .get('/api/history')
                .set('Authorization', `Bearer ${providerToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('TEST 20: should return 401 when accessing history without token', async () => {
            const res = await request(app)
                .get('/api/history');

            expect(res.statusCode).toEqual(401);
            expect(res.body.success).toBe(false);
        });
    });
});
