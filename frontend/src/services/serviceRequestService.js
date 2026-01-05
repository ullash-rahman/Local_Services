import api from './api';

export const serviceRequestService = {
    // Create a new service request
    createServiceRequest: async (requestData) => {
        try {
            const response = await api.post('/service-requests/create', requestData);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to create service request' };
        }
    },

    // Get service request by ID
    getServiceRequestById: async (requestID) => {
        try {
            const response = await api.get(`/service-requests/${requestID}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch service request' };
        }
    },

    // Get all service requests for current user
    getMyServiceRequests: async (status = null, category = null) => {
        try {
            const params = new URLSearchParams();
            if (status) params.append('status', status);
            if (category) params.append('category', category);
            
            const url = params.toString() 
                ? `/service-requests?${params.toString()}`
                : '/service-requests';
            console.log('API call - getMyServiceRequests:', { status, category, url });
            const response = await api.get(url);
            console.log('API response:', response.data);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch service requests' };
        }
    },

    // Get pending service requests (for providers)
    getPendingRequests: async (category = null) => {
        try {
            const url = category 
                ? `/service-requests/pending/all?category=${encodeURIComponent(category)}`
                : '/service-requests/pending/all';
            const response = await api.get(url);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch pending requests' };
        }
    },

    // Update service request
    updateServiceRequest: async (requestID, updateData) => {
        try {
            const response = await api.put(`/service-requests/${requestID}`, updateData);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to update service request' };
        }
    },

    // Delete service request
    deleteServiceRequest: async (requestID) => {
        try {
            const response = await api.delete(`/service-requests/${requestID}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to delete service request' };
        }
    },

    // Get service requests by category
    getServiceRequestsByCategory: async (category) => {
        try {
            const response = await api.get(`/service-requests/category/${encodeURIComponent(category)}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch service requests' };
        }
    },

    // Accept service request (Provider only)
    acceptServiceRequest: async (requestID) => {
        try {
            const response = await api.post(`/service-requests/${requestID}/accept`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to accept service request' };
        }
    },

    // Reject service request (Provider only)
    rejectServiceRequest: async (requestID) => {
        try {
            const response = await api.post(`/service-requests/${requestID}/reject`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to reject service request' };
        }
    },

    // Cancel service request (Customer only) - with cancellation reason
    cancelServiceRequest: async (requestID, cancellationReason) => {
        try {
            const response = await api.post(`/service-requests/${requestID}/cancel`, {
                cancellationReason
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to cancel service request' };
        }
    },

    // Start service (Provider only) - Change status from Accepted to Ongoing
    startService: async (requestID) => {
        try {
            const response = await api.post(`/service-requests/${requestID}/start`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to start service' };
        }
    },

    // Mark service as completed (Provider only)
    markServiceAsCompleted: async (requestID) => {
        try {
            const response = await api.post(`/service-requests/${requestID}/complete`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to mark service as completed' };
        }
    },

    // Confirm service completion (Customer only)
    confirmServiceCompletion: async (requestID) => {
        try {
            const response = await api.post(`/service-requests/${requestID}/confirm-completion`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to confirm service completion' };
        }
    }
};

