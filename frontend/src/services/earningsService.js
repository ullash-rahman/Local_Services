import api from './api';

/**
 * Earnings Service
 * API client methods for all earnings endpoints and helper functions for data formatting
 */
export const earningsService = {
    // ==================== Daily Earnings ====================

    /**
     * Get daily earnings for a specific date
     * @param {number} providerID - Provider's user ID
     * @param {string} date - Date in YYYY-MM-DD format
     * @param {string[]} categories - Optional category filter
     * @returns {Promise<DailyEarnings>} Daily earnings data
     */
    getDailyEarnings: async (providerID, date, categories = []) => {
        const params = new URLSearchParams();
        params.append('date', date);
        
        if (categories && categories.length > 0) {
            params.append('categories', categories.join(','));
        }

        const url = `/earnings/${providerID}/daily?${params.toString()}`;
        try {
            const response = await api.get(url);
            if (response.data && response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data?.message || 'Failed to fetch daily earnings');
        } catch (error) {
            console.error('getDailyEarnings error:', error.response?.data || error.message);
            throw error;
        }
    },

    /**
     * Get daily earnings for a date range
     * @param {number} providerID - Provider's user ID
     * @param {string} startDate - Start date in YYYY-MM-DD format
     * @param {string} endDate - End date in YYYY-MM-DD format
     * @param {string[]} categories - Optional category filter
     * @returns {Promise<DailyEarnings[]>} Array of daily earnings
     */
    getDailyEarningsRange: async (providerID, startDate, endDate, categories = []) => {
        const params = new URLSearchParams();
        params.append('startDate', startDate);
        params.append('endDate', endDate);
        
        if (categories && categories.length > 0) {
            params.append('categories', categories.join(','));
        }

        const url = `/earnings/${providerID}/daily/range?${params.toString()}`;
        const response = await api.get(url);
        return response.data.data;
    },

    // ==================== Monthly Earnings ====================

    /**
     * Get monthly earnings summary
     * @param {number} providerID - Provider's user ID
     * @param {number} year - Year (e.g., 2026)
     * @param {number} month - Month (1-12)
     * @param {string[]} categories - Optional category filter
     * @returns {Promise<MonthlyEarnings>} Monthly earnings data
     */
    getMonthlyEarnings: async (providerID, year, month, categories = []) => {
        const params = new URLSearchParams();
        params.append('year', year.toString());
        params.append('month', month.toString());
        
        if (categories && categories.length > 0) {
            params.append('categories', categories.join(','));
        }

        const url = `/earnings/${providerID}/monthly?${params.toString()}`;
        try {
            const response = await api.get(url);
            if (response.data && response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data?.message || 'Failed to fetch monthly earnings');
        } catch (error) {
            console.error('getMonthlyEarnings error:', error.response?.data || error.message);
            throw error;
        }
    },

    // ==================== Categories ====================

    /**
     * Get available service categories for a provider
     * @param {number} providerID - Provider's user ID
     * @returns {Promise<string[]>} Array of category names
     */
    getProviderCategories: async (providerID) => {
        const url = `/earnings/${providerID}/categories`;
        try {
            const response = await api.get(url);
            if (response.data && response.data.success) {
                return response.data.data;
            }
            return [];
        } catch (error) {
            console.error('getProviderCategories error:', error.response?.data || error.message);
            return [];
        }
    },

    // ==================== Goals ====================

    /**
     * Create or update an earnings goal
     * @param {number} providerID - Provider's user ID
     * @param {Object} goalData - Goal configuration
     * @param {string} goalData.goalType - 'daily' or 'monthly'
     * @param {number} goalData.targetAmount - Target earnings amount
     * @param {string} [goalData.startDate] - Optional start date
     * @param {string} [goalData.endDate] - Optional end date
     * @returns {Promise<EarningsGoal>} Created/updated goal
     */
    setGoal: async (providerID, goalData) => {
        const url = `/earnings/${providerID}/goals`;
        const response = await api.post(url, goalData);
        return response.data.data;
    },

    /**
     * Get active goals for a provider
     * @param {number} providerID - Provider's user ID
     * @returns {Promise<EarningsGoal[]>} Active goals
     */
    getActiveGoals: async (providerID) => {
        const url = `/earnings/${providerID}/goals`;
        try {
            const response = await api.get(url);
            if (response.data && response.data.success) {
                return response.data.data;
            }
            return [];
        } catch (error) {
            console.error('getActiveGoals error:', error.response?.data || error.message);
            return [];
        }
    },

    /**
     * Get progress toward a specific goal
     * @param {number} providerID - Provider's user ID
     * @param {number} goalID - Goal ID
     * @returns {Promise<GoalProgress>} Progress data
     */
    getGoalProgress: async (providerID, goalID) => {
        const url = `/earnings/${providerID}/goals/${goalID}/progress`;
        const response = await api.get(url);
        return response.data.data;
    },

    /**
     * Delete a goal
     * @param {number} providerID - Provider's user ID
     * @param {number} goalID - Goal ID
     * @returns {Promise<boolean>} Success status
     */
    deleteGoal: async (providerID, goalID) => {
        const url = `/earnings/${providerID}/goals/${goalID}`;
        const response = await api.delete(url);
        return response.data.success;
    },

    // ==================== Export ====================

    /**
     * Export earnings data as CSV
     * @param {number} providerID - Provider's user ID
     * @param {string} startDate - Start date in YYYY-MM-DD format
     * @param {string} endDate - End date in YYYY-MM-DD format
     * @param {string[]} categories - Optional category filter
     * @returns {Promise<Blob>} CSV file blob for download
     */
    exportEarnings: async (providerID, startDate, endDate, categories = []) => {
        const params = new URLSearchParams();
        params.append('startDate', startDate);
        params.append('endDate', endDate);
        
        if (categories && categories.length > 0) {
            params.append('categories', categories.join(','));
        }

        const url = `/earnings/${providerID}/export?${params.toString()}`;
        const response = await api.get(url, { responseType: 'blob' });
        return response.data;
    },

    // ==================== Helper Functions ====================

    /**
     * Format currency value
     * @param {number} value - Amount to format
     * @param {string} currency - Currency code (default: USD)
     * @returns {string} Formatted currency string
     */
    formatCurrency: (value, currency = 'USD') => {
        if (value === null || value === undefined) return '$0.00';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(value);
    },

    /**
     * Format percentage value
     * @param {number} value - Percentage value
     * @param {number} decimals - Number of decimal places
     * @returns {string} Formatted percentage string
     */
    formatPercentage: (value, decimals = 1) => {
        if (value === null || value === undefined) return '0%';
        return `${parseFloat(value).toFixed(decimals)}%`;
    },

    /**
     * Format date for display
     * @param {string} dateString - Date in YYYY-MM-DD format
     * @param {Object} options - Intl.DateTimeFormat options
     * @returns {string} Formatted date string
     */
    formatDate: (dateString, options = {}) => {
        if (!dateString) return '';
        
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };
        
        const date = new Date(dateString + 'T00:00:00');
        return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(date);
    },

    /**
     * Format month/year for display
     * @param {number} year - Year
     * @param {number} month - Month (1-12)
     * @returns {string} Formatted month string (e.g., "January 2026")
     */
    formatMonth: (year, month) => {
        const date = new Date(year, month - 1, 1);
        return new Intl.DateTimeFormat('en-US', { 
            year: 'numeric', 
            month: 'long' 
        }).format(date);
    },

    /**
     * Get trend indicator class based on change direction
     * @param {string} trend - 'up', 'down', or 'stable'
     * @param {boolean} positiveIsGood - Whether positive change is good (default: true)
     * @returns {string} CSS class name
     */
    getTrendClass: (trend, positiveIsGood = true) => {
        if (trend === 'stable') return 'trend-stable';
        
        if (positiveIsGood) {
            return trend === 'up' ? 'trend-positive' : 'trend-negative';
        }
        return trend === 'down' ? 'trend-positive' : 'trend-negative';
    },

    /**
     * Get trend arrow icon
     * @param {string} trend - 'up', 'down', or 'stable'
     * @returns {string} Arrow character
     */
    getTrendArrow: (trend) => {
        switch (trend) {
            case 'up': return '↑';
            case 'down': return '↓';
            default: return '→';
        }
    },

    /**
     * Calculate progress percentage
     * @param {number} current - Current amount
     * @param {number} target - Target amount
     * @returns {number} Progress percentage (0-100)
     */
    calculateProgress: (current, target) => {
        if (!target || target <= 0) return 0;
        const progress = (current / target) * 100;
        return Math.min(progress, 100);
    },

    /**
     * Get progress status
     * @param {number} progressPercentage - Progress percentage
     * @returns {string} Status: 'achieved', 'on-track', 'behind'
     */
    getProgressStatus: (progressPercentage) => {
        if (progressPercentage >= 100) return 'achieved';
        if (progressPercentage >= 75) return 'on-track';
        return 'behind';
    },

    /**
     * Get color intensity for heatmap based on earnings
     * @param {number} earnings - Earnings amount
     * @param {number} maxEarnings - Maximum earnings in the period
     * @returns {number} Intensity value (0-1)
     */
    getHeatmapIntensity: (earnings, maxEarnings) => {
        if (!maxEarnings || maxEarnings <= 0) return 0;
        return Math.min(earnings / maxEarnings, 1);
    },

    /**
     * Get heatmap color based on intensity
     * @param {number} intensity - Intensity value (0-1)
     * @returns {string} CSS color value
     */
    getHeatmapColor: (intensity) => {
        if (intensity === 0) return '#ebedf0';
        if (intensity < 0.25) return '#9be9a8';
        if (intensity < 0.5) return '#40c463';
        if (intensity < 0.75) return '#30a14e';
        return '#216e39';
    },

    /**
     * Format comparison data for display
     * @param {Object} comparison - Comparison object with amount, percentageChange, trend
     * @returns {Object} Formatted comparison data
     */
    formatComparison: (comparison) => {
        if (!comparison) {
            return {
                amount: '$0.00',
                change: '0%',
                trend: 'stable',
                trendClass: 'trend-stable',
                arrow: '→'
            };
        }

        return {
            amount: earningsService.formatCurrency(comparison.amount),
            change: earningsService.formatPercentage(comparison.percentageChange),
            trend: comparison.trend,
            trendClass: earningsService.getTrendClass(comparison.trend),
            arrow: earningsService.getTrendArrow(comparison.trend)
        };
    },

    /**
     * Get date string in YYYY-MM-DD format
     * @param {Date} date - Date object
     * @returns {string} Date string in YYYY-MM-DD format
     */
    toDateString: (date) => {
        if (!date) return '';
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * Get today's date string in YYYY-MM-DD format
     * @returns {string} Today's date string
     */
    getTodayString: () => {
        return earningsService.toDateString(new Date());
    },

    /**
     * Get current month and year
     * @returns {Object} Object with year and month properties
     */
    getCurrentMonth: () => {
        const now = new Date();
        return {
            year: now.getFullYear(),
            month: now.getMonth() + 1
        };
    },

    /**
     * Download blob as file
     * @param {Blob} blob - File blob
     * @param {string} filename - Filename for download
     */
    downloadBlob: (blob, filename) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    },

    /**
     * Generate export filename
     * @param {string} startDate - Start date
     * @param {string} endDate - End date
     * @returns {string} Generated filename
     */
    generateExportFilename: (startDate, endDate) => {
        return `earnings_${startDate}_to_${endDate}.csv`;
    }
};

export default earningsService;
