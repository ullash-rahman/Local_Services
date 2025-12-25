import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import analyticsService from '../../services/analyticsService';
import { authService } from '../../services/authService';
import RevenueSection from './RevenueSection';
import PerformanceSection from './PerformanceSection';
import CustomerSection from './CustomerSection';
import BenchmarkSection from './BenchmarkSection';
import ReportGenerator from '../Reports/ReportGenerator';
import ReportHistory from '../Reports/ReportHistory';
import './Analytics.css';

const AnalyticsDashboard = () => {
  // Tab options (Goals removed per user request)
  const tabOptions = [
    { value: 'overview', label: 'Overview' },
    { value: 'reports', label: 'Reports' }
  ];

  // Period options for filtering
  const periodOptions = [
    { value: '7days', label: 'Last 7 Days' },
    { value: '30days', label: 'Last 30 Days' },
    { value: '6months', label: 'Last 6 Months' },
    { value: '1year', label: 'Last Year' }
  ];

  // State management
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPeriod, setSelectedPeriod] = useState('30days');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Get current user
  const user = authService.getCurrentUser();
  const providerID = user?.userID;

  /**
   * Fetch dashboard data from API
   */
  const fetchDashboardData = useCallback(async () => {
    if (!providerID) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      // Fetch dashboard data and additional customer/benchmark data in parallel
      const [dashboardResponse, customerResponse, benchmarkResponse] = await Promise.all([
        analyticsService.getDashboard(providerID, { period: selectedPeriod }),
        analyticsService.getCustomerAnalytics(providerID, selectedPeriod).catch(() => null),
        analyticsService.getBenchmarks(providerID).catch(() => null)
      ]);
      
      // Extract data from API response format { success: true, data: {...} }
      const dashboardData = dashboardResponse?.data || dashboardResponse;
      const customerData = customerResponse?.data || customerResponse;
      const benchmarkData = benchmarkResponse?.data || benchmarkResponse;
      
      // Merge the data - use detailed customer/benchmark data if available
      const mergedData = {
        ...dashboardData,
        customers: customerData || dashboardData?.customers,
        benchmarks: benchmarkData || dashboardData?.benchmarks
      };
      
      setDashboardData(mergedData);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.response?.data?.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [providerID, selectedPeriod]);

  // Fetch data on mount and when period changes
  useEffect(() => {
    setLoading(true);
    fetchDashboardData();
  }, [fetchDashboardData]);

  /**
   * Handle period change
   */
  const handlePeriodChange = (e) => {
    setSelectedPeriod(e.target.value);
  };

  /**
   * Handle manual refresh
   */
  const handleRefresh = async () => {
    if (!providerID || refreshing) return;
    
    setRefreshing(true);
    try {
      await analyticsService.refreshAnalytics(providerID);
      await fetchDashboardData();
    } catch (err) {
      console.error('Error refreshing analytics:', err);
      setError('Failed to refresh analytics');
      setRefreshing(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="analytics-dashboard">
        <div className="analytics-loading">
          <div className="loading-spinner"></div>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="analytics-dashboard">
        <div className="analytics-error">
          <div className="error-icon">⚠️</div>
          <h3>Unable to Load Analytics</h3>
          <p>{error}</p>
          <button className="retry-button" onClick={fetchDashboardData}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      {/* Dashboard Header */}
      <div className="analytics-header">
        <div className="header-title">
          <h1>Performance Analytics</h1>
          <p className="header-subtitle">
            Track your business performance and growth
          </p>
        </div>
        
        <div className="header-controls">
          {/* Back to Dashboard Link */}
          <Link to="/dashboard/provider" className="back-link">
            ← Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="analytics-tabs">
        {tabOptions.map(tab => (
          <button
            key={tab.value}
            className={`tab-button ${activeTab === tab.value ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Period Selector and Refresh for Overview */}
          <div className="overview-controls">
            <div className="period-selector">
              <label htmlFor="period-select">Time Period:</label>
              <select
                id="period-select"
                value={selectedPeriod}
                onChange={handlePeriodChange}
                className="period-select"
              >
                {periodOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              className={`refresh-button ${refreshing ? 'refreshing' : ''}`}
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh analytics data"
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

          {/* Dashboard Content */}
          <div className="analytics-content">
            {/* Revenue Section */}
            <section className="analytics-section">
              <RevenueSection 
                data={dashboardData?.revenue} 
                period={selectedPeriod}
              />
            </section>

            {/* Performance Section */}
            <section className="analytics-section">
              <PerformanceSection 
                data={dashboardData?.performance} 
                period={selectedPeriod}
              />
            </section>

            {/* Customer Section */}
            <section className="analytics-section">
              <CustomerSection 
                data={dashboardData?.customers} 
                period={selectedPeriod}
              />
            </section>

            {/* Benchmark Section */}
            <section className="analytics-section">
              <BenchmarkSection 
                data={dashboardData?.benchmarks}
              />
            </section>
          </div>

          {/* Last Updated Timestamp */}
          {dashboardData?.lastUpdated && (
            <div className="analytics-footer">
              <span className="last-updated">
                Last updated: {new Date(dashboardData.lastUpdated).toLocaleString()}
              </span>
            </div>
          )}
        </>
      )}

      {activeTab === 'reports' && (
        <div className="tab-content reports-tab">
          <ReportGenerator />
          <ReportHistory />
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
