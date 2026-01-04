import React, { useState, useEffect, useCallback } from 'react';
import earningsService from '../../services/earningsService';
import './Earnings.css';

/**
 * DailyEarningsView - Component for displaying daily earnings with date picker and comparisons
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 5.3, 5.4
 * 
 * Features:
 * - Display today's earnings with date picker
 * - Show service count and category breakdown
 * - Display comparisons with previous day and same day last week
 * - Show goal progress if daily goal exists
 */
const DailyEarningsView = ({
    providerID,
    selectedDate,
    onDateChange,
    categoryFilter = [],
    goals = []
}) => {
    // Data state
    const [dailyData, setDailyData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    /**
     * Fetch daily earnings data
     */
    const fetchDailyData = useCallback(async () => {
        if (!providerID || !selectedDate) return;
        
        setIsLoading(true);
        setError(null);
        
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
        } finally {
            setIsLoading(false);
        }
    }, [providerID, selectedDate, categoryFilter]);

    // Fetch data when dependencies change
    useEffect(() => {
        fetchDailyData();
    }, [fetchDailyData]);

    /**
     * Handle date input change
     */
    const handleDateInputChange = (e) => {
        const newDate = new Date(e.target.value + 'T00:00:00');
        if (onDateChange) {
            onDateChange(newDate);
        }
    };

    /**
     * Get the active daily goal
     */
    const getDailyGoal = () => {
        return goals.find(g => g.goalType === 'daily' && g.isActive);
    };

    /**
     * Calculate goal progress
     */
    const calculateGoalProgress = (currentAmount, targetAmount) => {
        if (!targetAmount || targetAmount <= 0) return 0;
        return (currentAmount / targetAmount) * 100;
    };

    /**
     * Get progress bar status class
     */
    const getProgressStatusClass = (progressPercentage) => {
        if (progressPercentage >= 100) return 'achieved';
        if (progressPercentage >= 75) return 'on-track';
        return 'behind';
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="daily-earnings-view">
                <div className="daily-loading">
                    <div className="loading-spinner"></div>
                    <p>Loading daily earnings...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="daily-earnings-view">
                <div className="daily-error">
                    <div className="error-icon">⚠️</div>
                    <p>{error}</p>
                    <button className="retry-button" onClick={fetchDailyData}>
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    const dailyGoal = getDailyGoal();
    const currentEarnings = dailyData?.totalEarnings || 0;
    const goalProgress = dailyGoal 
        ? calculateGoalProgress(currentEarnings, dailyGoal.targetAmount)
        : 0;

    return (
        <div className="daily-earnings-view">
            {/* Date Picker Section */}
            <div className="daily-date-picker">
                <label htmlFor="daily-date-select">Select Date:</label>
                <input
                    type="date"
                    id="daily-date-select"
                    value={earningsService.toDateString(selectedDate)}
                    onChange={handleDateInputChange}
                    max={earningsService.getTodayString()}
                    className="date-input"
                />
            </div>

            {/* Summary Card - Requirements 1.1, 1.2 */}
            <div className="daily-summary-card">
                <div className="summary-header">
                    <h2>{earningsService.formatDate(earningsService.toDateString(selectedDate))}</h2>
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
                            {earningsService.formatCurrency(currentEarnings)}
                        </span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Services Completed</span>
                        <span className="stat-value">
                            {dailyData?.serviceCount || 0}
                        </span>
                    </div>
                </div>
            </div>

            {/* Goal Progress Section - Requirements 5.3, 5.4 */}
            {dailyGoal && (
                <div className="daily-goal-progress">
                    <h3>Daily Goal Progress</h3>
                    <div className="goal-info">
                        <span className="goal-target">
                            Target: {earningsService.formatCurrency(dailyGoal.targetAmount)}
                        </span>
                        <span className="goal-current">
                            Current: {earningsService.formatCurrency(currentEarnings)}
                        </span>
                    </div>
                    <div className="progress-bar-container">
                        <div 
                            className={`progress-bar ${getProgressStatusClass(goalProgress)}`}
                            style={{ width: `${Math.min(goalProgress, 100)}%` }}
                        />
                    </div>
                    <div className="goal-status">
                        <span className="progress-percentage">
                            {earningsService.formatPercentage(goalProgress)}
                        </span>
                        {goalProgress >= 100 && (
                            <span className="goal-achieved-badge">🎉 Goal Achieved!</span>
                        )}
                    </div>
                    {goalProgress < 100 && (
                        <p className="goal-remaining">
                            {earningsService.formatCurrency(Math.max(0, dailyGoal.targetAmount - currentEarnings))} remaining to reach your goal
                        </p>
                    )}
                </div>
            )}

            {/* Comparison Section - Requirements 3.1, 3.2 */}
            {dailyData?.comparison && (
                <div className="daily-comparison-section">
                    <h3>Comparison</h3>
                    <div className="comparison-cards">
                        {/* Previous Day Comparison - Requirement 3.1 */}
                        <div className="comparison-card">
                            <span className="comparison-label">vs Previous Day</span>
                            <div className={`comparison-value ${earningsService.getTrendClass(dailyData.comparison.previousDay?.trend)}`}>
                                <span className="trend-arrow">
                                    {earningsService.getTrendArrow(dailyData.comparison.previousDay?.trend)}
                                </span>
                                <span className="change-percentage">
                                    {earningsService.formatPercentage(dailyData.comparison.previousDay?.percentageChange || 0)}
                                </span>
                            </div>
                            <span className="comparison-amount">
                                {earningsService.formatCurrency(dailyData.comparison.previousDay?.amount || 0)}
                            </span>
                        </div>

                        {/* Same Day Last Week Comparison - Requirement 3.2 */}
                        <div className="comparison-card">
                            <span className="comparison-label">vs Same Day Last Week</span>
                            <div className={`comparison-value ${earningsService.getTrendClass(dailyData.comparison.sameLastWeek?.trend)}`}>
                                <span className="trend-arrow">
                                    {earningsService.getTrendArrow(dailyData.comparison.sameLastWeek?.trend)}
                                </span>
                                <span className="change-percentage">
                                    {earningsService.formatPercentage(dailyData.comparison.sameLastWeek?.percentageChange || 0)}
                                </span>
                            </div>
                            <span className="comparison-amount">
                                {earningsService.formatCurrency(dailyData.comparison.sameLastWeek?.amount || 0)}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Category Breakdown Section - Requirement 1.4 */}
            {dailyData?.categoryBreakdown && dailyData.categoryBreakdown.length > 0 && (
                <div className="daily-category-breakdown">
                    <h3>Earnings by Category</h3>
                    <div className="category-breakdown-list">
                        {dailyData.categoryBreakdown.map((cat, index) => (
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

            {/* Empty State - Requirement 1.5 */}
            {(!dailyData || currentEarnings === 0) && !isLoading && (
                <div className="daily-empty-state">
                    <div className="empty-icon">💰</div>
                    <h3>No Earnings for This Date</h3>
                    <p>No earnings were recorded on {earningsService.formatDate(earningsService.toDateString(selectedDate))}.</p>
                    {dailyGoal && (
                        <p className="empty-goal-hint">
                            Your daily goal is {earningsService.formatCurrency(dailyGoal.targetAmount)}. 
                            Keep working to reach it!
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default DailyEarningsView;
