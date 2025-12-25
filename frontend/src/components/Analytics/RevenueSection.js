import analyticsService from '../../services/analyticsService';
import LineChart from '../Charts/LineChart';
import PieChart from '../Charts/PieChart';

const RevenueSection = ({ data, period }) => {
  // Handle empty/loading state
  if (!data) {
    return (
      <div className="revenue-section">
        <div className="section-header">
          <h2 className="section-title">Revenue Analytics</h2>
        </div>
        <div className="empty-state">
          <span className="empty-state-icon">💰</span>
          <p className="empty-state-text">No revenue data available</p>
        </div>
      </div>
    );
  }

  // Extract data from backend response format
  const totalEarningsData = data.totalEarnings || {};
  const totalEarnings = totalEarningsData.currentPeriod?.totalEarnings || 0;
  const previousPeriodEarnings = totalEarningsData.previousPeriod?.totalEarnings || 0;
  const percentageChange = totalEarningsData.percentageChange || 0;
  const trend = totalEarningsData.trend || 'stable';

  // Get trend data from revenueTrends
  const trendData = (data.revenueTrends?.dataPoints || []).map(item => ({
    name: item.label,
    value: item.earnings || 0
  }));

  // Get category data from earningsByCategory
  const categoryData = (data.earningsByCategory?.categories || []).map(item => ({
    name: item.category,
    value: item.earnings || 0
  }));

  // Get payment status
  const paymentStatus = data.paymentStatus || {};
  const completedPayments = paymentStatus.completed?.amount || 0;
  const pendingPayments = paymentStatus.pending?.amount || 0;

  return (
    <div className="revenue-section">
      <div className="section-header">
        <div>
          <h2 className="section-title">Revenue Analytics</h2>
          <p className="section-subtitle">
            Track your earnings and payment status
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <p className="metric-label">Total Earnings</p>
          <p className="metric-value">
            {analyticsService.formatCurrency(totalEarnings)}
          </p>
          <div className={`metric-change ${trend === 'up' ? 'positive' : trend === 'down' ? 'negative' : 'neutral'}`}>
            <span className="change-icon">
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
            </span>
            <span>{Math.abs(percentageChange).toFixed(1)}% vs previous period</span>
          </div>
        </div>

        <div className="metric-card">
          <p className="metric-label">Previous Period</p>
          <p className="metric-value">
            {analyticsService.formatCurrency(previousPeriodEarnings)}
          </p>
          <div className="metric-change neutral">
            <span>{analyticsService.getPeriodLabel(period)}</span>
          </div>
        </div>

        <div className="metric-card">
          <p className="metric-label">Avg per Service</p>
          <p className="metric-value">
            {analyticsService.formatCurrency(data.averageEarnings?.averageEarnings || 0)}
          </p>
          <div className="metric-change neutral">
            <span>{data.averageEarnings?.completedServices || 0} services</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      {(trendData.length > 0 || categoryData.length > 0) && (
        <div className="charts-grid">
          {/* Revenue Trend Chart */}
          {trendData.length > 0 && (
            <div className="chart-wrapper">
              <LineChart
                data={trendData}
                xKey="name"
                lines={[{ dataKey: 'value', color: '#4a90d9', name: 'Revenue' }]}
                title="Revenue Trend"
                height={280}
                tooltipFormatter={(value) => analyticsService.formatCurrency(value)}
              />
            </div>
          )}

          {/* Category Breakdown Chart */}
          {categoryData.length > 0 && (
            <div className="chart-wrapper">
              <PieChart
                data={categoryData}
                title="Revenue by Category"
                height={280}
                donut={true}
                tooltipFormatter={(value) => analyticsService.formatCurrency(value)}
                colors={['#4a90d9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']}
              />
            </div>
          )}
        </div>
      )}

      {/* Payment Status */}
      <div className="payment-status">
        <div className="payment-item completed">
          <p className="payment-item-label">Completed Payments</p>
          <p className="payment-item-value">
            {analyticsService.formatCurrency(completedPayments)}
          </p>
        </div>
        <div className="payment-item pending">
          <p className="payment-item-label">Pending Payments</p>
          <p className="payment-item-value">
            {analyticsService.formatCurrency(pendingPayments)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default RevenueSection;
