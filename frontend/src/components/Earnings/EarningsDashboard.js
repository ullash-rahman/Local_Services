import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import earningsService from '../../services/earningsService';
import './Earnings.css';

/**
 * EarningsDashboard - Main container component for earnings analytics
 * Manages view mode switching (daily/monthly), date/month selection,
 * category filters, and data fetching for child components.
 * 
 * Requirements: 1.1, 2.1, 7.4
 */
const EarningsDashboard = () => {
    // Get current user
    const user = authService.getCurrentUser();
    const providerID = user?.userID;

    // View mode state
    const [viewMode, setViewMode] = useState('daily'); // 'daily' | 'monthly'

    // Date/Month selection state
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedMonth, setSelectedMonth] = useState(earningsService.getCurrentMonth());

    // Category filter state
    const [categoryFilter, setCategoryFilter] = useState([]);
    const [availableCategories, setAvailableCategories] = useState([]);

    // Data state
    const [dailyData, setDailyData] = useState(null);
    const [monthlyData, setMonthlyData] = useState(null);
    const [goals, setGoals] = useState([]);

    // UI state
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    /**
     * Fetch available categories for the provider
     */
    const fetchCategories = useCallback(async () => {
        if (!providerID) return;
        try {
            const categories = await earningsService.getProviderCategories(providerID);
            setAvailableCategories(categories || []);
        } catch (err) {
            console.error('Error fetching categories:', err);
        }
    }, [providerID]);

    /**
     * Fetch active goals for the provider
     */
    const fetchGoals = useCallback(async () => {
        if (!providerID) return;
        try {
            const goalsData = await earningsService.getActiveGoals(providerID);
            setGoals(goalsData || []);
        } catch (err) {
            console.error('Error fetching goals:', err);
        }
    }, [providerID]);

    /**
     * Fetch daily earnings data
     */
    const fetchDailyData = useCallback(async () => {
        if (!providerID) return;
        try {
            const dateStr = earningsService.toDateString(selectedDate);
            const data = await earningsService.getDailyEarnings(
                providerID,
                dateStr,
                categoryFilter
            );
            setDailyData(data);
        } catch (err) {
            console.error('Error fetching daily earnings:', err);
            setError('Failed to load daily earnings data');
        }
    }, [providerID, selectedDate, categoryFilter]);

    /**
     * Fetch monthly earnings data
     */
    const fetchMonthlyData = useCallback(async () => {
        if (!providerID) return;
        try {
            const data = await earningsService.getMonthlyEarnings(
                providerID,
                selectedMonth.year,
                selectedMonth.month,
                categoryFilter
            );
            setMonthlyData(data);
        } catch (err) {
            console.error('Error fetching monthly earnings:', err);
            setError('Failed to load monthly earnings data');
        }
    }, [providerID, selectedMonth, categoryFilter]);

    /**
     * Main data fetch based on view mode
     */
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            await Promise.all([
                fetchCategories(),
                fetchGoals(),
                viewMode === 'daily' ? fetchDailyData() : fetchMonthlyData()
            ]);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Failed to load earnings data');
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [viewMode, fetchCategories, fetchGoals, fetchDailyData, fetchMonthlyData]);

    // Initial data fetch
    useEffect(() => {
        if (providerID) {
            fetchData();
        } else {
            setError('User not authenticated');
            setIsLoading(false);
        }
    }, [providerID, fetchData]);

    /**
     * Handle view mode change
     */
    const handleViewModeChange = (mode) => {
        setViewMode(mode);
    };

    /**
     * Handle date change for daily view
     */
    const handleDateChange = (e) => {
        const newDate = new Date(e.target.value + 'T00:00:00');
        setSelectedDate(newDate);
    };

    /**
     * Handle month change for monthly view
     */
    const handleMonthChange = (e) => {
        const [year, month] = e.target.value.split('-').map(Number);
        setSelectedMonth({ year, month });
    };

    /**
     * Handle category filter change
     */
    const handleCategoryChange = (category) => {
        setCategoryFilter(prev => {
            if (prev.includes(category)) {
                return prev.filter(c => c !== category);
            }
            return [...prev, category];
        });
    };

    /**
     * Clear all category filters
     */
    const clearCategoryFilter = () => {
        setCategoryFilter([]);
    };

    /**
     * Handle manual refresh
     */
    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        await fetchData();
    };

    /**
     * Get current goal for the view mode
     */
    const getCurrentGoal = () => {
        const goalType = viewMode === 'daily' ? 'daily' : 'monthly';
        return goals.find(g => g.goalType === goalType && g.isActive);
    };

    /**
     * Format month value for input
     */
    const getMonthInputValue = () => {
        const month = String(selectedMonth.month).padStart(2, '0');
        return `${selectedMonth.year}-${month}`;
    };

    // Loading state
    if (isLoading && !refreshing) {
        return (
            <div className="earnings-dashboard">
                <div className="earnings-loading">
                    <div className="loading-spinner"></div>
                    <p>Loading earnings data...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error && !dailyData && !monthlyData) {
        return (
            <div className="earnings-dashboard">
                <div className="earnings-error">
                    <div className="error-icon">⚠️</div>
                    <h3>Unable to Load Earnings</h3>
                    <p>{error}</p>
                    <button className="retry-button" onClick={fetchData}>
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    const currentData = viewMode === 'daily' ? dailyData : monthlyData;
    const currentGoal = getCurrentGoal();

    return (
        <div className="earnings-dashboard">
            {/* Dashboard Header */}
            <div className="earnings-header">
                <div className="header-title">
                    <h1>Earnings Dashboard</h1>
                    <p className="header-subtitle">
                        Track your daily and monthly earnings
                    </p>
                </div>
                
                <div className="header-controls">
                    <Link to="/dashboard/provider" className="back-link">
                        ← Back to Dashboard
                    </Link>
                </div>
            </div>

            {/* View Mode Toggle */}
            <div className="view-mode-toggle">
                <button
                    className={`toggle-btn ${viewMode === 'daily' ? 'active' : ''}`}
                    onClick={() => handleViewModeChange('daily')}
                >
                    Daily
                </button>
                <button
                    className={`toggle-btn ${viewMode === 'monthly' ? 'active' : ''}`}
                    onClick={() => handleViewModeChange('monthly')}
                >
                    Monthly
                </button>
            </div>

            {/* Controls Section */}
            <div className="earnings-controls">
                {/* Date/Month Selector */}
                <div className="date-selector">
                    <label htmlFor="date-select">
                        {viewMode === 'daily' ? 'Select Date:' : 'Select Month:'}
                    </label>
                    {viewMode === 'daily' ? (
                        <input
                            type="date"
                            id="date-select"
                            value={earningsService.toDateString(selectedDate)}
                            onChange={handleDateChange}
                            max={earningsService.getTodayString()}
                            className="date-input"
                        />
                    ) : (
                        <input
                            type="month"
                            id="date-select"
                            value={getMonthInputValue()}
                            onChange={handleMonthChange}
                            className="date-input"
                        />
                    )}
                </div>

                {/* Category Filter */}
                {availableCategories.length > 0 && (
                    <div className="category-filter">
                        <label>Filter by Category:</label>
                        <div className="category-chips">
                            {availableCategories.map(category => (
                                <button
                                    key={category}
                                    className={`category-chip ${categoryFilter.includes(category) ? 'active' : ''}`}
                                    onClick={() => handleCategoryChange(category)}
                                >
                                    {category}
                                </button>
                            ))}
                            {categoryFilter.length > 0 && (
                                <button
                                    className="clear-filter-btn"
                                    onClick={clearCategoryFilter}
                                >
                                    Clear ({categoryFilter.length})
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Refresh Button */}
                <button
                    className={`refresh-button ${refreshing ? 'refreshing' : ''}`}
                    onClick={handleRefresh}
                    disabled={refreshing}
                >
                    {refreshing ? (
                        <>
                            <span className="refresh-icon spinning">↻</span>
                            Refreshing...
                        </>
                    ) : (
                        <>
                            <span className="refresh-icon">↻</span>
                            Refresh
                        </>
                    )}
                </button>
            </div>

            {/* Main Content */}
            <div className="earnings-content">
                {/* Summary Card */}
                <div className="earnings-summary-card">
                    <div className="summary-header">
                        <h2>
                            {viewMode === 'daily' 
                                ? earningsService.formatDate(earningsService.toDateString(selectedDate))
                                : earningsService.formatMonth(selectedMonth.year, selectedMonth.month)
                            }
                        </h2>
                        {categoryFilter.length > 0 && (
                            <span className="filter-badge">
                                Filtered: {categoryFilter.join(', ')}
                            </span>
                        )}
                    </div>

                    <div className="summary-stats">
                        <div className="stat-item primary">
                            <span className="stat-label">Total Earnings</span>
                            <span className="stat-value">
                                {earningsService.formatCurrency(currentData?.totalEarnings || 0)}
                            </span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Services Completed</span>
                            <span className="stat-value">
                                {currentData?.serviceCount || 0}
                            </span>
                        </div>
                        {viewMode === 'monthly' && monthlyData && (
                            <>
                                <div className="stat-item">
                                    <span className="stat-label">Daily Average</span>
                                    <span className="stat-value">
                                        {earningsService.formatCurrency(monthlyData.averageDailyEarnings || 0)}
                                    </span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Best Day</span>
                                    <span className="stat-value">
                                        {earningsService.formatCurrency(monthlyData.highestDay?.earnings || 0)}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Goal Progress */}
                {currentGoal && (
                    <div className="goal-progress-card">
                        <h3>{viewMode === 'daily' ? 'Daily' : 'Monthly'} Goal Progress</h3>
                        <div className="goal-info">
                            <span className="goal-target">
                                Target: {earningsService.formatCurrency(currentGoal.targetAmount)}
                            </span>
                            <span className="goal-current">
                                Current: {earningsService.formatCurrency(currentData?.totalEarnings || 0)}
                            </span>
                        </div>
                        <div className="progress-bar-container">
                            <div 
                                className={`progress-bar ${
                                    earningsService.getProgressStatus(
                                        earningsService.calculateProgress(
                                            currentData?.totalEarnings || 0,
                                            currentGoal.targetAmount
                                        )
                                    )
                                }`}
                                style={{
                                    width: `${Math.min(
                                        earningsService.calculateProgress(
                                            currentData?.totalEarnings || 0,
                                            currentGoal.targetAmount
                                        ),
                                        100
                                    )}%`
                                }}
                            />
                        </div>
                        <span className="progress-percentage">
                            {earningsService.formatPercentage(
                                earningsService.calculateProgress(
                                    currentData?.totalEarnings || 0,
                                    currentGoal.targetAmount
                                )
                            )}
                        </span>
                    </div>
                )}

                {/* Comparison Section */}
                {currentData?.comparison && (
                    <div className="comparison-section">
                        <h3>Comparison</h3>
                        <div className="comparison-cards">
                            {viewMode === 'daily' && dailyData?.comparison && (
                                <>
                                    <div className="comparison-card">
                                        <span className="comparison-label">vs Previous Day</span>
                                        <div className={`comparison-value ${earningsService.getTrendClass(dailyData.comparison.previousDay?.trend)}`}>
                                            <span className="trend-arrow">
                                                {earningsService.getTrendArrow(dailyData.comparison.previousDay?.trend)}
                                            </span>
                                            <span>
                                                {earningsService.formatPercentage(dailyData.comparison.previousDay?.percentageChange || 0)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="comparison-card">
                                        <span className="comparison-label">vs Same Day Last Week</span>
                                        <div className={`comparison-value ${earningsService.getTrendClass(dailyData.comparison.sameLastWeek?.trend)}`}>
                                            <span className="trend-arrow">
                                                {earningsService.getTrendArrow(dailyData.comparison.sameLastWeek?.trend)}
                                            </span>
                                            <span>
                                                {earningsService.formatPercentage(dailyData.comparison.sameLastWeek?.percentageChange || 0)}
                                            </span>
                                        </div>
                                    </div>
                                </>
                            )}
                            {viewMode === 'monthly' && monthlyData?.comparison && (
                                <>
                                    <div className="comparison-card">
                                        <span className="comparison-label">vs Previous Month</span>
                                        <div className={`comparison-value ${earningsService.getTrendClass(monthlyData.comparison.previousMonth?.trend)}`}>
                                            <span className="trend-arrow">
                                                {earningsService.getTrendArrow(monthlyData.comparison.previousMonth?.trend)}
                                            </span>
                                            <span>
                                                {earningsService.formatPercentage(monthlyData.comparison.previousMonth?.percentageChange || 0)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="comparison-card">
                                        <span className="comparison-label">vs Same Month Last Year</span>
                                        <div className={`comparison-value ${earningsService.getTrendClass(monthlyData.comparison.sameMonthLastYear?.trend)}`}>
                                            <span className="trend-arrow">
                                                {earningsService.getTrendArrow(monthlyData.comparison.sameMonthLastYear?.trend)}
                                            </span>
                                            <span>
                                                {earningsService.formatPercentage(monthlyData.comparison.sameMonthLastYear?.percentageChange || 0)}
                                            </span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Category Breakdown */}
                {currentData?.categoryBreakdown && currentData.categoryBreakdown.length > 0 && (
                    <div className="category-breakdown-section">
                        <h3>Earnings by Category</h3>
                        <div className="category-breakdown-list">
                            {currentData.categoryBreakdown.map((cat, index) => (
                                <div key={index} className="category-breakdown-item">
                                    <div className="category-info">
                                        <span className="category-name">{cat.category}</span>
                                        <span className="category-services">
                                            {cat.serviceCount} service{cat.serviceCount !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <div className="category-earnings">
                                        <span className="category-amount">
                                            {earningsService.formatCurrency(cat.earnings)}
                                        </span>
                                        <span className="category-percentage">
                                            {earningsService.formatPercentage(cat.percentage)}
                                        </span>
                                    </div>
                                    <div className="category-bar-container">
                                        <div 
                                            className="category-bar"
                                            style={{ width: `${cat.percentage}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {(!currentData || currentData.totalEarnings === 0) && (
                    <div className="empty-state">
                        <div className="empty-icon">💰</div>
                        <h3>No Earnings Data</h3>
                        <p>
                            {viewMode === 'daily' 
                                ? 'No earnings recorded for this date.'
                                : 'No earnings recorded for this month.'
                            }
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EarningsDashboard;