import api from './api';

export const bundleService = {
    // Get all active bundles (for customers to browse)
    getAllActiveBundles: async (category = null) => {
        try {
            const url = category 
                ? `/bundles/browse?category=${encodeURIComponent(category)}`
                : '/bundles/browse';
            const response = await api.get(url);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch bundles' };
        }
    },

    // Get bundle by ID
    getBundleById: async (bundleID) => {
        try {
            const response = await api.get(`/bundles/${bundleID}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch bundle' };
        }
    },

    // Create a new bundle (Provider only)
    createBundle: async (bundleData) => {
        try {
            const response = await api.post('/bundles/create', bundleData);
            return response.data;
        } catch (error) {
            // Preserve the full error response data
            const errorData = error.response?.data || { message: 'Failed to create bundle' };
            console.error('Bundle service error:', errorData);
            console.error('Full error:', error);
            throw errorData;
        }
    },

    // Get all bundles by current provider
    getMyBundles: async (includeInactive = false) => {
        try {
            const url = includeInactive 
                ? '/bundles/my-bundles?includeInactive=true'
                : '/bundles/my-bundles';
            const response = await api.get(url);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch my bundles' };
        }
    },

    // Update bundle (Provider only)
    updateBundle: async (bundleID, updateData) => {
        try {
            const response = await api.put(`/bundles/${bundleID}`, updateData);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to update bundle' };
        }
    },

    // Remove bundle (Provider only)
    removeBundle: async (bundleID) => {
        try {
            const response = await api.delete(`/bundles/${bundleID}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to remove bundle' };
        }
    }
};

