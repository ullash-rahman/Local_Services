import api from './api';

export const maintenanceService = {
    // Get all maintenance reminders
    getMaintenanceReminders: async (status = null) => {
        try {
            const url = status 
                ? `/maintenance?status=${status}`
                : '/maintenance';
            const response = await api.get(url);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch maintenance reminders' };
        }
    },

    // Get upcoming maintenance reminders
    getUpcomingReminders: async (daysAhead = 7) => {
        try {
            const response = await api.get(`/maintenance/upcoming?daysAhead=${daysAhead}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch upcoming reminders' };
        }
    },

    // Get overdue maintenance reminders
    getOverdueReminders: async () => {
        try {
            const response = await api.get('/maintenance/overdue');
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch overdue reminders' };
        }
    },

    // Get maintenance reminder by ID
    getMaintenanceReminderById: async (reminderID) => {
        try {
            const response = await api.get(`/maintenance/${reminderID}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch maintenance reminder' };
        }
    },

    // Create maintenance reminder
    createMaintenanceReminder: async (reminderData) => {
        try {
            const response = await api.post('/maintenance', reminderData);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to create maintenance reminder' };
        }
    },

    // Update maintenance reminder
    updateMaintenanceReminder: async (reminderID, updateData) => {
        try {
            const response = await api.put(`/maintenance/${reminderID}`, updateData);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to update maintenance reminder' };
        }
    },

    // Delete maintenance reminder
    deleteMaintenanceReminder: async (reminderID) => {
        try {
            const response = await api.delete(`/maintenance/${reminderID}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to delete maintenance reminder' };
        }
    },

    // Mark reminder as completed
    markReminderAsCompleted: async (reminderID, completionDate = null) => {
        try {
            const response = await api.post(`/maintenance/${reminderID}/complete`, {
                completionDate
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to mark reminder as completed' };
        }
    }
};

