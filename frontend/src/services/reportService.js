import api from './api';

export const reportService = {

    generateReport: async (options) => {
        const response = await api.post('/reports/generate', options);
        return response.data;
    },

    getTemplates: async () => {
        const response = await api.get('/reports/templates');
        return response.data;
    },

    getReportHistory: async (providerID, options = {}) => {
        const params = new URLSearchParams();
        
        if (options.page) params.append('page', options.page);
        if (options.limit) params.append('limit', options.limit);

        const queryString = params.toString();
        const url = `/reports/history/${providerID}${queryString ? `?${queryString}` : ''}`;
        
        const response = await api.get(url);
        return response.data;
    },

    downloadReport: async (reportID) => {
        const response = await api.get(`/reports/download/${reportID}`, {
            responseType: 'blob'
        });
        return response.data;
    },

    downloadReportFile: async (reportID, filename = 'report') => {
        try {
            const blob = await reportService.downloadReport(reportID);
            
            // Validate blob is not empty
            if (!blob || blob.size === 0) {
                throw new Error('Downloaded file is empty');
            }
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            
            // Cleanup
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            return { success: true };
        } catch (error) {
            console.error('Error downloading report:', error);
            throw new Error(`Download failed: ${error.message || 'Unknown error'}`);
        }
    },

    scheduleReport: async (schedule) => {
        const response = await api.post('/reports/schedule', schedule);
        return response.data;
    },

    cancelScheduledReport: async (scheduleID) => {
        const response = await api.delete(`/reports/schedule/${scheduleID}`);
        return response.data;
    },

    getFileExtension: (format) => {
        const extensions = {
            'pdf': '.pdf',
            'csv': '.csv',
            'xlsx': '.xlsx',
            'excel': '.xlsx'
        };
        return extensions[format?.toLowerCase()] || '.pdf';
    },

    getMimeType: (format) => {
        const mimeTypes = {
            'pdf': 'application/pdf',
            'csv': 'text/csv',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };
        return mimeTypes[format?.toLowerCase()] || 'application/pdf';
    },

    formatDateForFilename: (date) => {
        const d = new Date(date);
        return d.toISOString().split('T')[0];
    },

    generateFilename: (reportType, startDate, endDate, format) => {
        const start = reportService.formatDateForFilename(startDate);
        const end = reportService.formatDateForFilename(endDate);
        const ext = reportService.getFileExtension(format);
        
        return `${reportType}_${start}_to_${end}${ext}`;
    },

    getFrequencyLabel: (frequency) => {
        const labels = {
            'daily': 'Daily',
            'weekly': 'Weekly',
            'monthly': 'Monthly'
        };
        return labels[frequency] || frequency;
    },

    getFormatLabel: (format) => {
        const labels = {
            'pdf': 'PDF Document',
            'csv': 'CSV Spreadsheet',
            'xlsx': 'Excel Spreadsheet'
        };
        return labels[format?.toLowerCase()] || format;
    },

    getAvailableFormats: () => {
        return [
            { value: 'pdf', label: 'PDF Document', icon: 'file-pdf' },
            { value: 'csv', label: 'CSV Spreadsheet', icon: 'file-csv' },
            { value: 'xlsx', label: 'Excel Spreadsheet', icon: 'file-excel' }
        ];
    },

    getAvailableFrequencies: () => {
        return [
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' }
        ];
    },

    validateDateRange: (startDate, endDate) => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const today = new Date();
        
        if (isNaN(start.getTime())) {
            return { isValid: false, error: 'Invalid start date' };
        }
        
        if (isNaN(end.getTime())) {
            return { isValid: false, error: 'Invalid end date' };
        }
        
        if (start > end) {
            return { isValid: false, error: 'Start date must be before end date' };
        }
        
        if (end > today) {
            return { isValid: false, error: 'End date cannot be in the future' };
        }
        
        return { isValid: true, error: null };
    }
};

export default reportService;
