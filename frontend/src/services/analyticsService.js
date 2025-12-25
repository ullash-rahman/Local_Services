import api from './api';

export const analyticsService = {

    getDashboard: async (providerID, options = {}) => {
        const params = new URLSearchParams();
        
        if (options.period) params.append('period', options.period);

        const queryString = params.toString();
        const url = `/analytics/dashboard/${providerID}${queryString ? `?${queryString}` : ''}`;
        
        const response = await api.get(url);
        return response.data;
    },

    getRevenueAnalytics: async (providerID, period = '30days') => {
        const params = new URLSearchParams();
        params.append('period', period);

        const url = `/analytics/revenue/${providerID}?${params.toString()}`;
        
        const response = await api.get(url);
        return response.data;
    },

    getPerformanceMetrics: async (providerID, period = '30days') => {
        const params = new URLSearchParams();
        params.append('period', period);

        const url = `/analytics/performance/${providerID}?${params.toString()}`;
        
        const response = await api.get(url);
        return response.data;
    },

    getCustomerAnalytics: async (providerID, period = '30days') => {
        const params = new URLSearchParams();
        params.append('period', period);

        const url = `/analytics/customers/${providerID}?${params.toString()}`;
        
        const response = await api.get(url);
        return response.data;
    },

    getBenchmarks: async (providerID) => {
        const url = `/analytics/benchmarks/${providerID}`;
        
        const response = await api.get(url);
        return response.data;
    },

    getRealTimeMetrics: async (providerID) => {
        const url = `/analytics/realtime/${providerID}`;
        
        const response = await api.get(url);
        return response.data;
    },

    refreshAnalytics: async (providerID) => {
        const url = `/analytics/refresh/${providerID}`;
        
        const response = await api.post(url);
        return response.data;
    },

    formatCurrency: (value, currency = 'USD') => {
        if (value === null || value === undefined) return '$0.00';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(value);
    },

    formatPercentage: (value, decimals = 1) => {
        if (value === null || value === undefined) return '0%';
        return `${parseFloat(value).toFixed(decimals)}%`;
    },

    formatDuration: (minutes) => {
        if (minutes === null || minutes === undefined) return '0 min';
        
        if (minutes < 60) {
            return `${Math.round(minutes)} min`;
        }
        
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = Math.round(minutes % 60);
        
        if (remainingMinutes === 0) {
            return `${hours} hr`;
        }
        
        return `${hours} hr ${remainingMinutes} min`;
    },

    getPeriodLabel: (period) => {
        const labels = {
            '7days': 'Last 7 Days',
            '30days': 'Last 30 Days',
            '6months': 'Last 6 Months',
            '1year': 'Last Year'
        };
        return labels[period] || period;
    },

    calculateChange: (current, previous) => {
        if (!previous || previous === 0) {
            return { value: 0, direction: 'neutral' };
        }
        
        const change = ((current - previous) / previous) * 100;
        
        return {
            value: Math.abs(change).toFixed(1),
            direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
        };
    },

    formatTrendData: (data, valueKey = 'value', labelKey = 'date') => {
        if (!data || !Array.isArray(data)) return [];
        
        return data.map(item => ({
            label: item[labelKey],
            value: parseFloat(item[valueKey]) || 0
        }));
    },

    getBenchmarkStatus: (providerValue, benchmarkValue) => {
        if (providerValue > benchmarkValue) return 'above';
        if (providerValue < benchmarkValue) return 'below';
        return 'equal';
    },

    getBenchmarkClass: (status, higherIsBetter = true) => {
        if (status === 'equal') return 'benchmark-equal';
        
        if (higherIsBetter) {
            return status === 'above' ? 'benchmark-positive' : 'benchmark-negative';
        }
        
        return status === 'below' ? 'benchmark-positive' : 'benchmark-negative';
    }
};

export default analyticsService;

