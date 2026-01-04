const RevenueAnalytics = require('../services/RevenueAnalytics');
const PerformanceAnalytics = require('../services/PerformanceAnalytics');
const CustomerAnalytics = require('../services/CustomerAnalytics');
const BenchmarkingService = require('../services/BenchmarkingService');
const RealTimeAnalytics = require('../services/RealTimeAnalytics');
const Gamification = require('../models/Gamification');
const EarningsService = require('../services/EarningsService');

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

        // Fetch all analytics data in parallel, with error handling for each
        const [
            revenueData,
            performanceData,
            customerData,
            realTimeData,
            gamificationData
        ] = await Promise.all([
            RevenueAnalytics.getDashboardData(validation.providerID, period).catch(err => {
                console.error('Error fetching revenue data:', err);
                return null;
            }),
            PerformanceAnalytics.getPerformanceSummary(validation.providerID, period).catch(err => {
                console.error('Error fetching performance data:', err);
                return null;
            }),
            CustomerAnalytics.getUniqueCustomerCount(validation.providerID, period).catch(err => {
                console.error('Error fetching customer data:', err);
                return null;
            }),
            RealTimeAnalytics.getTodayMetrics(validation.providerID).catch(err => {
                console.error('Error fetching real-time data:', err);
                return null;
            }),
            // Fetch gamification data: points, rank, and recent badges
            (async () => {
                try {
                    const [gamificationStats, rankingData] = await Promise.all([
                        Gamification.getGamificationData(validation.providerID),
                        Gamification.getMonthlyRanking(validation.providerID)
                    ]);
                    
                    return {
                        totalPoints: gamificationStats.totalPoints || 0,
                        monthlyPoints: gamificationStats.monthlyPoints || 0,
                        rank: rankingData.rank || 0,
                        previousRank: rankingData.previousRank || 0,
                        percentile: rankingData.percentile || 0,
                        tier: gamificationStats.tier || 'Beginner',
                        badges: gamificationStats.badgesEarned || [],
                        recentBadges: (gamificationStats.badgesEarned || []).slice(-3) // Last 3 badges earned
                    };
                } catch (err) {
                    console.error('Error fetching gamification data:', err);
                    return null;
                }
            })()
        ]);

        // Cross-validate revenue data consistency (Task 8.2)
        let revenueConsistency = null;
        if (revenueData) {
            try {
                // Get current date for earnings comparison
                const today = new Date();
                const year = today.getFullYear();
                const month = today.getMonth() + 1;
                
                // Get earnings from EarningsService for comparison
                const earningsData = await EarningsService.getMonthlyEarnings(validation.providerID, year, month).catch(() => null);
                
                if (earningsData && revenueData.totalEarnings) {
                    const paymentRevenue = revenueData.totalEarnings.currentPeriod?.totalEarnings || 0;
                    const earningsTotal = earningsData.totalEarnings || 0;
                    
                    // Check if values are consistent (within tolerance for different query periods)
                    const difference = Math.abs(paymentRevenue - earningsTotal);
                    const isConsistent = difference < 0.01 || (paymentRevenue === 0 && earningsTotal === 0);
                    
                    revenueConsistency = {
                        paymentServiceRevenue: paymentRevenue,
                        earningsServiceRevenue: earningsTotal,
                        isConsistent,
                        difference: parseFloat(difference.toFixed(2)),
                        note: 'Revenue data cross-validated between Payment and Earnings services'
                    };
                }
            } catch (err) {
                console.error('Error validating revenue consistency:', err);
            }
        }

        res.status(200).json({
            success: true,
            data: {
                providerID: validation.providerID,
                period,
                revenue: revenueData,
                performance: performanceData,
                customers: customerData,
                realTime: realTimeData,
                gamification: gamificationData,
                revenueConsistency,
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

        // Fetch all customer analytics in parallel, with error handling
        const [
            uniqueCustomers,
            retentionRate,
            geographicDistribution,
            peakServiceTimes,
            acquisitionTrends,
            customerLifetimeValue
        ] = await Promise.all([
            CustomerAnalytics.getUniqueCustomerCount(validation.providerID, period).catch(() => null),
            CustomerAnalytics.getRetentionRate(validation.providerID).catch(() => null),
            CustomerAnalytics.getGeographicDistribution(validation.providerID).catch(() => null),
            CustomerAnalytics.getPeakServiceTimes(validation.providerID).catch(() => null),
            CustomerAnalytics.getAcquisitionTrends(validation.providerID, period).catch(() => null),
            CustomerAnalytics.getCustomerLifetimeValue(validation.providerID).catch(() => null)
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

        // Fetch all benchmarking data in parallel, with error handling
        const [
            platformAverages,
            percentileRankings,
            yearOverYearComparison,
            seasonalTrends,
            improvementSuggestions
        ] = await Promise.all([
            BenchmarkingService.getPlatformAverages().catch(() => null),
            BenchmarkingService.getPercentileRankings(validation.providerID).catch(() => null),
            BenchmarkingService.getYearOverYearComparison(validation.providerID).catch(() => null),
            BenchmarkingService.getSeasonalTrends(validation.providerID).catch(() => null),
            BenchmarkingService.getImprovementSuggestions(validation.providerID).catch(() => null)
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

        // Force refresh all analytics data including gamification
        const [
            revenueData,
            performanceData,
            customerData,
            realTimeData,
            gamificationData
        ] = await Promise.all([
            RevenueAnalytics.getDashboardData(validation.providerID, period),
            PerformanceAnalytics.getPerformanceSummary(validation.providerID, period),
            CustomerAnalytics.getUniqueCustomerCount(validation.providerID, period),
            RealTimeAnalytics.getTodayMetrics(validation.providerID),
            // Fetch gamification data
            (async () => {
                try {
                    const [gamificationStats, rankingData] = await Promise.all([
                        Gamification.getGamificationData(validation.providerID),
                        Gamification.getMonthlyRanking(validation.providerID)
                    ]);
                    
                    return {
                        totalPoints: gamificationStats.totalPoints || 0,
                        monthlyPoints: gamificationStats.monthlyPoints || 0,
                        rank: rankingData.rank || 0,
                        previousRank: rankingData.previousRank || 0,
                        percentile: rankingData.percentile || 0,
                        tier: gamificationStats.tier || 'Beginner',
                        badges: gamificationStats.badgesEarned || [],
                        recentBadges: (gamificationStats.badgesEarned || []).slice(-3)
                    };
                } catch (err) {
                    console.error('Error fetching gamification data:', err);
                    return null;
                }
            })()
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
                gamification: gamificationData,
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