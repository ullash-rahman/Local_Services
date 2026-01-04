import api from './api';

export const availabilityService = {
    // Set availability for a provider
    setAvailability: async (date, timeSlot, available = true) => {
        try {
            const response = await api.post('/availability/set', {
                date,
                timeSlot,
                available
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to set availability' };
        }
    },

    // Bulk set availability for multiple time slots
    bulkSetAvailability: async (date, timeSlots, available = true) => {
        try {
            const response = await api.post('/availability/bulk-set', {
                date,
                timeSlots,
                available
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to set availability' };
        }
    },

    // Get availability for the current provider
    getMyAvailability: async (startDate, endDate) => {
        try {
            const params = {};
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            const response = await api.get('/availability/my-availability', { params });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch availability' };
        }
    },

    // Get availability for a specific provider
    getProviderAvailability: async (providerID, startDate, endDate) => {
        try {
            const params = {};
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            const response = await api.get(`/availability/provider/${providerID}`, { params });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch provider availability' };
        }
    },

    // Delete availability
    deleteAvailability: async (date, timeSlot = null) => {
        try {
            const response = await api.delete('/availability/delete', {
                data: { date, timeSlot }
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to delete availability' };
        }
    },

    // Get available providers for a specific date and time slot
    getAvailableProviders: async (date, timeSlot) => {
        try {
            const response = await api.get('/availability/available-providers', {
                params: { date, timeSlot }
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch available providers' };
        }
    }
};

