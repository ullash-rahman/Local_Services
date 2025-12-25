import { useState, useEffect, useCallback } from 'react';
import analyticsService from '../../services/analyticsService';
import { authService } from '../../services/authService';
import './Analytics.css';

const RealTimeDashboard = () => {
  // State management
  const [realTimeData, setRealTimeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Auto-refresh interval (30 seconds)
  const REFRESH_INTERVAL = 30000;

  // Get current user
  const user = authService.getCurrentUser();
  const providerID = user?.userID;

  /**
   * Fetch real-time metrics from API
   */
  const fetchRealTimeData = useCallback(async () => {
    if (!providerID) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await analyticsService.getRealTimeMetrics(providerID);
      setRealTimeData(data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching real-time data:', err);
      setError(err.response?.data?.message || 'Failed to load real-time data');
    } finally {
      setLoading(false);
    }
  }, [providerID]);

  // Initial fetch and auto-refresh setup
  useEffect(() => {
    fetchRealTimeData();

    let intervalId;
    if (autoRefresh) {
      intervalId = setInterval(fetchRealTimeData, REFRESH_INTERVAL);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchRealTimeData, autoRefresh]);

  /**
   * Toggle auto-refresh
   */
  const handleAutoRefreshToggle = () => {
    setAutoRefresh(prev => !prev);
  };

  /**
   * Manual refresh
   */
  const handleManualRefresh = () => {
    setLoading(true);
    fetchRealTimeData();
  };

  /**
   * Format time ago
   */
  const formatTimeAgo = (date) => {
    if (!date) return '';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  /**
   * Get activity icon based on type
   */
  const getActivityIcon = (type) => {
    const icons = {
      review: '⭐',
      request: '📋',
      message: '💬',
      payment: '💰'
    };
    return icons[type] || '📌';
  };

  /**
   * Get trend indicator
   */
  const getTrendIndicator = (trend, change) => {
    if (trend === 'up') {
      return <span className="metric-change positive">↑ {Math.abs(change)}%</span>;
    }
    if (trend === 'down') {
      return <span className="metric-change negative">↓ {Math.abs(change)}%</span>;
    }
    return <span className="metric-change neutral">— 0%</span>;
  };

  /**
   * Get queue health class
   */
  const getQueueHealthClass = (health) => {
    const classes = {
      good: 'queue-health-good',
      warning: 'queue-health-warning',
      critical: 'queue-health-critical'
    };
    return classes[health] || '';
  };

  // Loading state
  if (loading && !realTimeData) {
    return (
      <div className="realtime-dashboard">
        <div className="analytics-loading">
          <div className="loading-spinner"></div>
          <p>Loading real-time data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !realTimeData) {
    return (
      <div className="realtime-dashboard">
        <div className="analytics-error">
          <div className="error-icon">⚠️</div>
          <h3>Unable to Load Real-Time Data</h3>
          <p>{error}</p>
          <button className="retry-button" onClick={handleManualRefresh}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { todayMetrics, queueStatus, recentActivity } = realTimeData || {};

  return (
    <div className="realtime-dashboard">
      {/* Dashboard Header */}
      <div className="realtime-header">
        <div className="header-title">
          <h2>Real-Time Monitoring</h2>
          <p className="header-subtitle">
            Live performance metrics and activity
          </p>
        </div>
        
        <div className="realtime-controls">
          {/* Auto-refresh toggle */}
          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={handleAutoRefreshToggle}
            />
            <span>Auto-refresh</span>
          </label>

          {/* Manual refresh button */}
          <button
            className={`refresh-button ${loading ? 'refreshing' : ''}`}
            onClick={handleManualRefresh}
            disabled={loading}
          >
            <span className={`refresh-icon ${loading ? 'spinning' : ''}`}>↻</span>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>

          {/* Last refresh time */}
          {lastRefresh && (
            <span className="last-refresh-time">
              Updated {formatTimeAgo(lastRefresh)}
            </span>
          )}
        </div>
      </div>
      <section className="realtime-section">
        <div className="section-header">
          <h3 className="section-title">Today's Metrics</h3>
          <span className="section-date">{todayMetrics?.date}</span>
        </div>

        <div className="metrics-grid">
          {/* Requests Received */}
          <div className="metric-card">
            <p className="metric-label">Requests Received</p>
            <p className="metric-value">{todayMetrics?.requests?.total || 0}</p>
            {getTrendIndicator(
              todayMetrics?.requests?.trend,
              todayMetrics?.requests?.changeFromYesterday
            )}
          </div>

          {/* Requests Completed */}
          <div className="metric-card">
            <p className="metric-label">Completed</p>
            <p className="metric-value">{todayMetrics?.requests?.completed || 0}</p>
            {getTrendIndicator(
              todayMetrics?.comparison?.completedRequestsChange > 0 ? 'up' : 
              todayMetrics?.comparison?.completedRequestsChange < 0 ? 'down' : 'stable',
              todayMetrics?.comparison?.completedRequestsChange
            )}
          </div>

          {/* Today's Earnings */}
          <div className="metric-card">
            <p className="metric-label">Earnings</p>
            <p className="metric-value">
              ${todayMetrics?.earnings?.formattedCompleted || '0.00'}
            </p>
            {getTrendIndicator(
              todayMetrics?.earnings?.trend,
              todayMetrics?.earnings?.changeFromYesterday
            )}
          </div>

          {/* Pending Earnings */}
          <div className="metric-card">
            <p className="metric-label">Pending Payments</p>
            <p className="metric-value">
              ${todayMetrics?.earnings?.formattedPending || '0.00'}
            </p>
            <span className="metric-subtext">
              {todayMetrics?.earnings?.pendingPayments || 0} payments
            </span>
          </div>

          {/* New Customers */}
          <div className="metric-card">
            <p className="metric-label">New Customers</p>
            <p className="metric-value">{todayMetrics?.customers?.new || 0}</p>
            <span className="metric-subtext">
              {todayMetrics?.customers?.returning || 0} returning
            </span>
          </div>

          {/* Today's Reviews */}
          <div className="metric-card">
            <p className="metric-label">Reviews</p>
            <p className="metric-value">{todayMetrics?.reviews?.count || 0}</p>
            {todayMetrics?.reviews?.averageRating > 0 && (
              <span className="metric-subtext">
                ⭐ {todayMetrics?.reviews?.averageRating} avg
              </span>
            )}
          </div>
        </div>
      </section>
      <section className="realtime-section">
        <div className="section-header">
          <h3 className="section-title">Queue Status</h3>
          <span className={`queue-health-badge ${getQueueHealthClass(queueStatus?.queue?.health)}`}>
            {queueStatus?.queue?.health || 'unknown'}
          </span>
        </div>

        <div className="queue-overview">
          <div className="queue-stats">
            <div className="queue-stat">
              <span className="queue-stat-value">{queueStatus?.queue?.pending || 0}</span>
              <span className="queue-stat-label">Pending</span>
            </div>
            <div className="queue-stat">
              <span className="queue-stat-value">{queueStatus?.queue?.accepted || 0}</span>
              <span className="queue-stat-label">Accepted</span>
            </div>
            <div className="queue-stat">
              <span className="queue-stat-value">{queueStatus?.queue?.inProgress || 0}</span>
              <span className="queue-stat-label">In Progress</span>
            </div>
            <div className="queue-stat">
              <span className="queue-stat-value">{queueStatus?.unreadMessages || 0}</span>
              <span className="queue-stat-label">Unread Messages</span>
            </div>
          </div>

          {/* Response Time */}
          <div className="response-time-card">
            <p className="response-time-label">Avg Response Time Today</p>
            <p className="response-time-value">
              {queueStatus?.responseTime?.today?.average?.formatted || 'N/A'}
            </p>
            <span className="response-time-count">
              Based on {queueStatus?.responseTime?.today?.responseCount || 0} responses
            </span>
          </div>
        </div>

        {/* Queue Items */}
        {queueStatus?.queue?.items?.length > 0 && (
          <div className="queue-items">
            <h4 className="queue-items-title">Active Requests</h4>
            <div className="queue-items-list">
              {queueStatus.queue.items.slice(0, 5).map((item) => (
                <div key={item.requestID} className="queue-item">
                  <div className="queue-item-info">
                    <span className="queue-item-customer">{item.customerName}</span>
                    <span className="queue-item-category">{item.category}</span>
                  </div>
                  <div className="queue-item-meta">
                    <span className={`queue-item-priority priority-${item.priorityLevel?.toLowerCase()}`}>
                      {item.priorityLevel}
                    </span>
                    <span className="queue-item-status">{item.status}</span>
                    <span className="queue-item-wait">{item.waitingTime?.formatted}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
      <section className="realtime-section">
        <div className="section-header">
          <h3 className="section-title">Recent Activity</h3>
          <span className="activity-count">
            {recentActivity?.count || 0} activities
          </span>
        </div>

        {recentActivity?.activities?.length > 0 ? (
          <div className="activity-feed">
            {recentActivity.activities.map((activity, index) => (
              <div key={`${activity.type}-${activity.id}-${index}`} className="activity-item">
                <span className="activity-icon">{getActivityIcon(activity.type)}</span>
                <div className="activity-content">
                  <p className="activity-summary">{activity.summary}</p>
                  <span className="activity-time">{formatTimeAgo(activity.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-state-icon">📭</span>
            <p className="empty-state-text">No recent activity</p>
          </div>
        )}

        {/* Activity Summary */}
        {recentActivity?.summary && (
          <div className="activity-summary-bar">
            <span className="activity-summary-item">
              ⭐ {recentActivity.summary.reviews} reviews
            </span>
            <span className="activity-summary-item">
              📋 {recentActivity.summary.requests} requests
            </span>
            <span className="activity-summary-item">
              💬 {recentActivity.summary.messages} messages
              {recentActivity.summary.unreadMessages > 0 && (
                <span className="unread-badge">{recentActivity.summary.unreadMessages} new</span>
              )}
            </span>
            <span className="activity-summary-item">
              💰 {recentActivity.summary.payments} payments
            </span>
          </div>
        )}
      </section>
    </div>
  );
};

export default RealTimeDashboard;

