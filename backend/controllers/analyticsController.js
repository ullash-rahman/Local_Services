const RevenueAnalytics = require('../services/RevenueAnalytics');
const PerformanceAnalytics = require('../services/PerformanceAnalytics');
const CustomerAnalytics = require('../services/CustomerAnalytics');
const BenchmarkingService = require('../services/BenchmarkingService');
const RealTimeAnalytics = require('../services/RealTimeAnalytics');

// Helper to validate provider access
const validateProviderAccess = (req, providerID) => {
    const parsedProviderID = parseInt(providerID, 10);
    
    if (isNaN(parsedProviderID) || parsedProviderID <= 0) {
        return { valid: false, error: 'Invalid provider ID', statusCode: 400 };
    }

    const requestingUserID = req.user?.userID;
    const isOwnAnalytics = requestingUserID === parsedProviderID;
    const isAdmin = req.user?.role === 'Admin';

    if (!isOwnAnalytics && !isAdmin) {
        return { valid: false, error: 'You can only view your own analytics', statusCode: 403 };
    }

    return { valid: true, providerID: parsedProviderID };
};

const getDashboard = async (req, res) => {
    try {
        const { providerID } = req.params;
        const validation = validateProviderAccess(req, providerID);
        
        if (!validation.valid) {
            return res.status(validation.statusCode).json({
                success: false,
                message: validation.error
            });
        }

        const period = req.query.period || '30days';

        console.log('Getting dashboard analytics', { providerID: validation.providerID, period });

        // Fetch all analytics data in parallel
        const [
            revenueData,
            performanceData,
            customerData,
            realTimeData
        ] = await Promise.all([
            RevenueAnalytics.getDashboardData(validation.providerID, period),
            PerformanceAnalytics.getPerformanceSummary(validation.providerID, period),
            CustomerAnalytics.getUniqueCustomerCount(validation.providerID, period),
            RealTimeAnalytics.getTodayMetrics(validation.providerID)
        ]);

        res.status(200).json({
            success: true,
            data: {
                providerID: validation.providerID,
                period,
                revenue: revenueData,
                performance: performanceData,
                customers: customerData,
                realTime: realTimeData,
                generatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Get dashboard error:', { error: error.message });
        
        if (error.statusCode === 400) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error while fetching dashboard analytics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

const getRevenueAnalytics = async (req, res) => {
    try {
        const { providerID } = req.params;
        const validation = validateProviderAccess(req, providerID);
        
        if (!validation.valid) {
            return res.status(validation.statusCode).json({
                success: false,
                message: validation.error
            });
        }

        const period = req.query.period || '30days';

        console.log('Getting revenue analytics', { providerID: validation.providerID, period });

        const revenueData = await RevenueAnalytics.getDashboardData(validation.providerID, period);

        res.status(200).json({
            success: true,
            data: {
                providerID: validation.providerID,
                ...revenueData
            }
        });
    } catch (error) {
        console.error('Get revenue analytics error:', { error: error.message });
        
        if (error.statusCode === 400) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error while fetching revenue analytics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

const getPerformanceMetrics = async (req, res) => {
    try {
        const { providerID } = req.params;
        const validation = validateProviderAccess(req, providerID);
        
        if (!validation.valid) {
            return res.status(validation.statusCode).json({
                success: false,
                message: validation.error
            });
        }

        const period = req.query.period || '30days';

        console.log('Getting performance metrics', { providerID: validation.providerID, period });

        const performanceData = await PerformanceAnalytics.getPerformanceSummary(validation.providerID, period);

        res.status(200).json({
            success: true,
            data: {
                providerID: validation.providerID,
                ...performanceData
            }
        });
    } catch (error) {
        console.error('Get performance metrics error:', { error: error.message });
        
        if (error.statusCode === 400) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error while fetching performance metrics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

const getCustomerAnalytics = async (req, res) => {
    try {
        const { providerID } = req.params;
        const validation = validateProviderAccess(req, providerID);
        
        if (!validation.valid) {
            return res.status(validation.statusCode).json({
                success: false,
                message: validation.error
            });
        }

        const period = req.query.period || '30days';

        console.log('Getting customer analytics', { providerID: validation.providerID, period });

        // Fetch all customer analytics in parallel
        const [
            uniqueCustomers,
            retentionRate,
            geographicDistribution,
            peakServiceTimes,
            acquisitionTrends,
            customerLifetimeValue
        ] = await Promise.all([
            CustomerAnalytics.getUniqueCustomerCount(validation.providerID, period),
            CustomerAnalytics.getRetentionRate(validation.providerID),
            CustomerAnalytics.getGeographicDistribution(validation.providerID),
            CustomerAnalytics.getPeakServiceTimes(validation.providerID),
            CustomerAnalytics.getAcquisitionTrends(validation.providerID, period),
            CustomerAnalytics.getCustomerLifetimeValue(validation.providerID)
        ]);

        res.status(200).json({
            success: true,
            data: {
                providerID: validation.providerID,
                period,
                uniqueCustomers,
                retentionRate,
                geographicDistribution,
                peakServiceTimes,
                acquisitionTrends,
                customerLifetimeValue,
                generatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Get customer analytics error:', { error: error.message });
        
        if (error.statusCode === 400) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error while fetching customer analytics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

const getBenchmarks = async (req, res) => {
    try {
        const { providerID } = req.params;
        const validation = validateProviderAccess(req, providerID);
        
        if (!validation.valid) {
            return res.status(validation.statusCode).json({
                success: false,
                message: validation.error
            });
        }

        console.log('Getting benchmarks', { providerID: validation.providerID });

        // Fetch all benchmarking data in parallel
        const [
            platformAverages,
            percentileRankings,
            yearOverYearComparison,
            seasonalTrends,
            improvementSuggestions
        ] = await Promise.all([
            BenchmarkingService.getPlatformAverages(),
            BenchmarkingService.getPercentileRankings(validation.providerID),
            BenchmarkingService.getYearOverYearComparison(validation.providerID),
            BenchmarkingService.getSeasonalTrends(validation.providerID),
            BenchmarkingService.getImprovementSuggestions(validation.providerID)
        ]);

        res.status(200).json({
            success: true,
            data: {
                providerID: validation.providerID,
                platformAverages,
                percentileRankings,
                yearOverYearComparison,
                seasonalTrends,
                improvementSuggestions,
                generatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Get benchmarks error:', { error: error.message });
        
        if (error.statusCode === 400) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error while fetching benchmarks',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

const getRealTimeMetrics = async (req, res) => {
    try {
        const { providerID } = req.params;
        const validation = validateProviderAccess(req, providerID);
        
        if (!validation.valid) {
            return res.status(validation.statusCode).json({
                success: false,
                message: validation.error
            });
        }

        const limit = parseInt(req.query.limit, 10) || 10;

        console.log('Getting real-time metrics', { providerID: validation.providerID });

        // Fetch all real-time data in parallel
        const [
            todayMetrics,
            queueStatus,
            thresholdAlerts,
            recentActivity
        ] = await Promise.all([
            RealTimeAnalytics.getTodayMetrics(validation.providerID),
            RealTimeAnalytics.getQueueStatus(validation.providerID),
            RealTimeAnalytics.checkThresholds(validation.providerID),
            RealTimeAnalytics.getRecentActivity(validation.providerID, limit)
        ]);

        res.status(200).json({
            success: true,
            data: {
                providerID: validation.providerID,
                todayMetrics,
                queueStatus,
                thresholdAlerts,
                recentActivity,
                generatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Get real-time metrics error:', { error: error.message });
        
        if (error.statusCode === 400) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error while fetching real-time metrics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

const refreshAnalytics = async (req, res) => {
    try {
        const { providerID } = req.params;
        const validation = validateProviderAccess(req, providerID);
        
        if (!validation.valid) {
            return res.status(validation.statusCode).json({
                success: false,
                message: validation.error
            });
        }

        const period = req.query.period || '30days';

        console.log('Refreshing analytics', { providerID: validation.providerID, period });

        // Force refresh all analytics data
        const [
            revenueData,
            performanceData,
            customerData,
            realTimeData
        ] = await Promise.all([
            RevenueAnalytics.getDashboardData(validation.providerID, period),
            PerformanceAnalytics.getPerformanceSummary(validation.providerID, period),
            CustomerAnalytics.getUniqueCustomerCount(validation.providerID, period),
            RealTimeAnalytics.getTodayMetrics(validation.providerID)
        ]);

        res.status(200).json({
            success: true,
            message: 'Analytics refreshed successfully',
            data: {
                providerID: validation.providerID,
                period,
                revenue: revenueData,
                performance: performanceData,
                customers: customerData,
                realTime: realTimeData,
                refreshedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Refresh analytics error:', { error: error.message });
        
        if (error.statusCode === 400) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error while refreshing analytics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

module.exports = {
    getDashboard,
    getRevenueAnalytics,
    getPerformanceMetrics,
    getCustomerAnalytics,
    getBenchmarks,
    getRealTimeMetrics,
    refreshAnalytics
};