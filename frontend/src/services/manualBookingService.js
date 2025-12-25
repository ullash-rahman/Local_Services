import api from './api';

export const manualBookingService = {
    // Get list of available providers
    getProviders: async () => {
        try {
            const response = await api.get('/manual-booking/providers');
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch providers' };
        }
    },

    // Create a new manual booking
    createManualBooking: async (bookingData) => {
        try {
            const response = await api.post('/manual-booking/create', bookingData);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to create manual booking' };
        }
    },

    // Get all manual bookings for the current customer
    getMyManualBookings: async () => {
        try {
            const response = await api.get('/manual-booking/my-bookings');
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch manual bookings' };
        }
    },

    // Get a specific manual booking by ID
    getManualBookingById: async (bookingID) => {
        try {
            const response = await api.get(`/manual-booking/${bookingID}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch manual booking' };
        }
    },

    // Update a manual booking
    updateManualBooking: async (bookingID, updateData) => {
        try {
            const response = await api.put(`/manual-booking/${bookingID}`, updateData);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to update manual booking' };
        }
    },

    // Cancel a manual booking
    cancelManualBooking: async (bookingID, cancellationReason) => {
        try {
            const response = await api.post(`/manual-booking/${bookingID}/cancel`, {
                cancellationReason
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to cancel manual booking' };
        }
    },

    // Provider methods
    // Get pending manual bookings for provider
    getPendingManualBookings: async () => {
        try {
            const response = await api.get('/manual-booking/pending');
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch pending manual bookings' };
        }
    },

    // Accept a manual booking (Provider only)
    acceptManualBooking: async (bookingID) => {
        try {
            const response = await api.post(`/manual-booking/${bookingID}/accept`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to accept manual booking' };
        }
    },

    // Reject a manual booking (Provider only)
    rejectManualBooking: async (bookingID) => {
        try {
            const response = await api.post(`/manual-booking/${bookingID}/reject`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to reject manual booking' };
        }
    }
};
