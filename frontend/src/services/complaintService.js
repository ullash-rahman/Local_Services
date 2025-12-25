import axios from 'axios';
import { authService } from './authService';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// Create axios instance with auth token
const getAuthHeaders = () => {
    const token = authService.getToken();
    return {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };
};

export const complaintService = {
    // Submit a new complaint
    submitComplaint: async (requestID, description) => {
        try {
            const response = await axios.post(
                `${API_URL}/complaints/submit`,
                { requestID, description },
                getAuthHeaders()
            );
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to submit complaint' };
        }
    },

    // Get all complaints filed by the current user
    getMyComplaints: async () => {
        try {
            const response = await axios.get(
                `${API_URL}/complaints/my-complaints`,
                getAuthHeaders()
            );
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch complaints' };
        }
    },

    // Get complaints against the current user
    getComplaintsAgainstMe: async () => {
        try {
            const response = await axios.get(
                `${API_URL}/complaints/against-me`,
                getAuthHeaders()
            );
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch complaints' };
        }
    },

    // Get complaint by ID
    getComplaintById: async (complaintID) => {
        try {
            const response = await axios.get(
                `${API_URL}/complaints/${complaintID}`,
                getAuthHeaders()
            );
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch complaint' };
        }
    },

    // Get complaints for a specific service request
    getComplaintsByRequest: async (requestID) => {
        try {
            const response = await axios.get(
                `${API_URL}/complaints/request/${requestID}`,
                getAuthHeaders()
            );
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch complaints' };
        }
    },

    // Update complaint status (Admin only)
    updateComplaintStatus: async (complaintID, status, resolutionNotes = null) => {
        try {
            const response = await axios.put(
                `${API_URL}/complaints/${complaintID}/status`,
                { status, resolutionNotes },
                getAuthHeaders()
            );
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to update complaint status' };
        }
    },

    // Get all complaints (Admin only)
    getAllComplaints: async (status = null) => {
        try {
            const url = status 
                ? `${API_URL}/complaints?status=${status}`
                : `${API_URL}/complaints`;
            const response = await axios.get(url, getAuthHeaders());
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch complaints' };
        }
    }
};

