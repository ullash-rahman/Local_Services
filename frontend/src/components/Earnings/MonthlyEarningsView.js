import React, { useState, useEffect, useCallback } from 'react';
import earningsService from '../../services/earningsService';
import CalendarHeatmap from './CalendarHeatmap';
import './Earnings.css';

/**
 * MonthlyEarningsView - Component for displaying monthly earnings with calendar heatmap
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.3, 3.4, 5.3, 5.4
 * 
 * Features:
 * - Display monthly total with month/year selector
 * - Show calendar heatmap with daily earnings intensity
 * - Display average daily, highest/lowest days
 * - Show comparisons with previous month and same month last year
 * - Show goal progress if monthly goal exists
 */
const MonthlyEarningsView = ({
    providerID,
    selectedYear,
    selectedMonth,
    onMonthChange,
    categoryFilter = [],
    goals = []
}) => {
    // Data state
    const [monthlyData, setMonthlyData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedDay, setSelectedDay] = useState(null);

    /**
     * Fetch monthly earnings data
     */
    const fetchMonthlyData = useCallback(async () => {
        if (!providerID || !selectedYear || !selectedMonth) return;
        
        setIsLoading(true);
        setError(null);
        
        try {
            const data = await earningsService.getMonthlyEarnings(
                providerID,
                selectedYear,
                selectedMonth,
                categoryFilter
            );
            setMonthlyData(data);
        } catch (err) {
            console.error('Error fetching monthly earnings:', err);
            setError('Failed to load monthly earnings data');
        } finally {
            setIsLoading(false);
        }
    }, [providerID, selectedYear, selectedMonth, categoryFilter]);

    // Fetch data when dependencies change
    useEffect(() => {
        fetchMonthlyData();
    }, [fetchMonthlyData]);

    /**
     * Handle month input change
     */
    const handleMonthInputChange = (e) => {
        const [year, month] = e.target.value.split('-').map(Number);
        if (onMonthChange) {
            onMonthChange(year, month);
        }
    };

    /**
     * Handle day click from calendar heatmap
     */
    const handleDayClick = (dayData) => {
        setSelectedDay(dayData);
    };

    /**
     * Close day details modal
     */
    const closeDayDetails = () => {
        setSelectedDay(null);
    };

    /**
     * Get the active monthly goal
     */
    const getMonthlyGoal = () => {
        return goals.find(g => g.goalType === 'monthly' && g.isActive);
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

    /**
     * Format month value for input
     */
    const getMonthInputValue = () => {
        const month = String(selectedMonth).padStart(2, '0');
        return `${selectedYear}-${month}`;
    };

    /**
     * Get max month value (current month)
     */
    const getMaxMonthValue = () => {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${now.getFullYear()}-${month}`;
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="monthly-earnings-view">
                <div className="monthly-loading">
                    <div className="loading-spinner"></div>
                    <p>Loading monthly earnings...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="monthly-earnings-view">
                <div className="monthly-error">
                    <div className="error-icon">⚠️</div>
                    <p>{error}</p>
                    <button className="retry-button" onClick={fetchMonthlyData}>
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    const monthlyGoal = getMonthlyGoal();
    const currentEarnings = monthlyData?.totalEarnings || 0;
    const goalProgress = monthlyGoal 
        ? calculateGoalProgress(currentEarnings, monthlyGoal.targetAmount)
        : 0;

    return (
        <div className="monthly-earnings-view">
            {/* Month Picker Section */}
            <div className="monthly-date-picker">
                <label htmlFor="monthly-date-select">Select Month:</label>
                <input
                    type="month"
                    id="monthly-date-select"
                    value={getMonthInputValue()}
                    onChange={handleMonthInputChange}
                    max={getMaxMonthValue()}
                    className="date-input"
                />
            </div>

            {/* Summary Card - Requirements 2.1, 2.3 */}
            <div className="monthly-summary-card">
                <div className="summary-header">
                    <h2>{earningsService.formatMonth(selectedYear, selectedMonth)}</h2>
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
                            {monthlyData?.serviceCount || 0}
                        </span>
                    </div>
                    {/* Requirement 2.4 - Average daily earnings */}
                    <div className="stat-item">
                        <span className="stat-label">Daily Average</span>
                        <span className="stat-value">
                            {earningsService.formatCurrency(monthlyData?.averageDailyEarnings || 0)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Highest/Lowest Days - Requirement 2.5 */}
            {monthlyData && (monthlyData.highestDay || monthlyData.lowestDay) && (
                <div className="monthly-highlights">
                    <h3>Month Highlights</h3>
                    <div className="highlights-grid">
                        {monthlyData.highestDay && monthlyData.highestDay.earnings > 0 && (
                            <div className="highlight-card best">
                                <div className="highlight-icon">🏆</div>
                                <div className="highlight-content">
                                    <span className="highlight-label">Best Day</span>
                                    <span className="highlight-date">
                                        {earningsService.formatDate(monthlyData.highestDay.date)}
                                    </span>
                                    <span className="highlight-amount">
                                        {earningsService.formatCurrency(monthlyData.highestDay.earnings)}
                                    </span>
                                </div>
                            </div>
                        )}
                        {monthlyData.lowestDay && monthlyData.lowestDay.earnings > 0 && (
                            <div className="highlight-card lowest">
                                <div className="highlight-icon">📉</div>
                                <div className="highlight-content">
                                    <span className="highlight-label">Lowest Day</span>
                                    <span className="highlight-date">
                                        {earningsService.formatDate(monthlyData.lowestDay.date)}
                                    </span>
                                    <span className="highlight-amount">
                                        {earningsService.formatCurrency(monthlyData.lowestDay.earnings)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Goal Progress Section - Requirements 5.3, 5.4 */}
            {monthlyGoal && (
                <div className="monthly-goal-progress">
                    <h3>Monthly Goal Progress</h3>
                    <div className="goal-info">
                        <span className="goal-target">
                            Target: {earningsService.formatCurrency(monthlyGoal.targetAmount)}
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
                            {earningsService.formatCurrency(Math.max(0, monthlyGoal.targetAmount - currentEarnings))} remaining to reach your goal
                        </p>
                    )}
                </div>
            )}

            {/* Calendar Heatmap - Requirement 2.2 */}
            {monthlyData?.dailyBreakdown && monthlyData.dailyBreakdown.length > 0 && (
                <div className="monthly-calendar-section">
                    <h3>Daily Earnings Calendar</h3>
                    <CalendarHeatmap
                        year={selectedYear}
                        month={selectedMonth}
                        dailyData={monthlyData.dailyBreakdown}
                        onDayClick={handleDayClick}
                    />
                </div>
            )}

            {/* Comparison Section - Requirements 3.3, 3.4 */}
            {monthlyData?.comparison && (
                <div className="monthly-comparison-section">
                    <h3>Comparison</h3>
                    <div className="comparison-cards">
                        {/* Previous Month Comparison - Requirement 3.3 */}
                        <div className="comparison-card">
                            <span className="comparison-label">vs Previous Month</span>
                            <div className={`comparison-value ${earningsService.getTrendClass(monthlyData.comparison.previousMonth?.trend)}`}>
                                <span className="trend-arrow">
                                    {earningsService.getTrendArrow(monthlyData.comparison.previousMonth?.trend)}
                                </span>
                                <span className="change-percentage">
                                    {earningsService.formatPercentage(monthlyData.comparison.previousMonth?.percentageChange || 0)}
                                </span>
                            </div>
                            <span className="comparison-amount">
                                {earningsService.formatCurrency(monthlyData.comparison.previousMonth?.amount || 0)}
                            </span>
                        </div>

                        {/* Same Month Last Year Comparison - Requirement 3.4 */}
                        <div className="comparison-card">
                            <span className="comparison-label">vs Same Month Last Year</span>
                            <div className={`comparison-value ${earningsService.getTrendClass(monthlyData.comparison.sameMonthLastYear?.trend)}`}>
                                <span className="trend-arrow">
                                    {earningsService.getTrendArrow(monthlyData.comparison.sameMonthLastYear?.trend)}
                                </span>
                                <span className="change-percentage">
                                    {earningsService.formatPercentage(monthlyData.comparison.sameMonthLastYear?.percentageChange || 0)}
                                </span>
                            </div>
                            <span className="comparison-amount">
                                {earningsService.formatCurrency(monthlyData.comparison.sameMonthLastYear?.amount || 0)}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Category Breakdown */}
            {monthlyData?.categoryBreakdown && monthlyData.categoryBreakdown.length > 0 && (
                <div className="monthly-category-breakdown">
                    <h3>Earnings by Category</h3>
                    <div className="category-breakdown-list">
                        {monthlyData.categoryBreakdown.map((cat, index) => (
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
            {(!monthlyData || currentEarnings === 0) && !isLoading && (
                <div className="monthly-empty-state">
                    <div className="empty-icon">📅</div>
                    <h3>No Earnings for This Month</h3>
                    <p>No earnings were recorded in {earningsService.formatMonth(selectedYear, selectedMonth)}.</p>
                    {monthlyGoal && (
                        <p className="empty-goal-hint">
                            Your monthly goal is {earningsService.formatCurrency(monthlyGoal.targetAmount)}. 
                            Keep working to reach it!
                        </p>
                    )}
                </div>
            )}

            {/* Day Details Modal */}
            {selectedDay && (
                <div className="day-details-modal-overlay" onClick={closeDayDetails}>
                    <div className="day-details-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{earningsService.formatDate(selectedDay.date)}</h3>
                            <button className="modal-close" onClick={closeDayDetails}>×</button>
                        </div>
                        <div className="modal-content">
                            <div className="modal-stat">
                                <span className="modal-stat-label">Earnings</span>
                                <span className="modal-stat-value">
                                    {earningsService.formatCurrency(selectedDay.earnings)}
                                </span>
                            </div>
                            <div className="modal-stat">
                                <span className="modal-stat-label">Services</span>
                                <span className="modal-stat-value">
                                    {selectedDay.serviceCount}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MonthlyEarningsView;
