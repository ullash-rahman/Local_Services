import analyticsService from '../../services/analyticsService';
import BarChart from '../Charts/BarChart';

const CustomerSection = ({ data, period }) => {
  // Handle empty/loading state
  if (!data) {
    return (
      <div className="customer-section">
        <div className="section-header">
          <h2 className="section-title">Customer Analytics</h2>
        </div>
        <div className="empty-state">
          <span className="empty-state-icon">👥</span>
          <p className="empty-state-text">No customer data available</p>
        </div>
      </div>
    );
  }

  // Extract data from backend response format
  // Backend returns: uniqueCustomers (object with period, uniqueCustomers, etc.), retentionRate (object), peakServiceTimes (object), acquisitionTrends (object)
  const uniqueCustomersData = data.uniqueCustomers || data;
  const retentionData = data.retentionRate || {};
  const peakTimesData = data.peakServiceTimes || {};
  const acquisitionData = data.acquisitionTrends || {};

  // Extract values with fallbacks
  const uniqueCustomers = uniqueCustomersData.uniqueCustomers || uniqueCustomersData.totalCustomers || 0;
  const previousUniqueCustomers = uniqueCustomersData.previousPeriod?.uniqueCustomers || 0;
  const retentionRate = retentionData.retentionRate || 0;
  const repeatCustomerPercentage = retentionData.repeatCustomerPercentage || 0;
  
  // Peak times - extract from peakDays array
  const peakTimes = peakTimesData.peakDays || peakTimesData.dailyDistribution || [];
  
  // New vs returning customers from acquisition trends
  const newCustomers = acquisitionData.summary?.totalNewCustomers || 0;
  const returningCustomers = acquisitionData.summary?.totalReturningCustomers || 0;

  // Calculate changes
  const customerChange = analyticsService.calculateChange(uniqueCustomers, previousUniqueCustomers);

  // Calculate new vs returning ratio
  const totalCustomers = newCustomers + returningCustomers;
  const newPercentage = totalCustomers > 0 ? (newCustomers / totalCustomers) * 100 : 0;
  const returningPercentage = totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;

  // Format peak times data for bar chart
  const peakTimesChartData = peakTimes.map(item => ({
    name: item.dayName || item.day || item.time || item.label || 'Unknown',
    value: parseInt(item.requestCount || item.count || item.value) || 0
  }));

  return (
    <div className="customer-section">
      <div className="section-header">
        <div>
          <h2 className="section-title">Customer Analytics</h2>
          <p className="section-subtitle">
            Understand your customer base and engagement
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <p className="metric-label">Unique Customers</p>
          <p className="metric-value">{uniqueCustomers.toLocaleString()}</p>
          <div className={`metric-change ${customerChange.direction === 'up' ? 'positive' : customerChange.direction === 'down' ? 'negative' : 'neutral'}`}>
            <span className="change-icon">
              {customerChange.direction === 'up' ? '↑' : customerChange.direction === 'down' ? '↓' : '→'}
            </span>
            <span>{customerChange.value}% vs previous period</span>
          </div>
        </div>

        <div className="metric-card">
          <p className="metric-label">Retention Rate</p>
          <p className="metric-value">
            {analyticsService.formatPercentage(retentionRate)}
          </p>
          <div className="metric-change neutral">
            <span>Customers who return</span>
          </div>
        </div>

        <div className="metric-card">
          <p className="metric-label">Repeat Customers</p>
          <p className="metric-value">
            {analyticsService.formatPercentage(repeatCustomerPercentage)}
          </p>
          <div className="metric-change neutral">
            <span>{analyticsService.getPeriodLabel(period)}</span>
          </div>
        </div>
      </div>

      {/* New vs Returning Customer Ratio */}
      <div className="customer-ratio">
        <div className="ratio-bar">
          {newPercentage > 0 && (
            <div 
              className="ratio-segment new" 
              style={{ width: `${newPercentage}%` }}
            >
              {newPercentage >= 10 && `${newPercentage.toFixed(0)}%`}
            </div>
          )}
          {returningPercentage > 0 && (
            <div 
              className="ratio-segment returning" 
              style={{ width: `${returningPercentage}%` }}
            >
              {returningPercentage >= 10 && `${returningPercentage.toFixed(0)}%`}
            </div>
          )}
        </div>
        <div className="ratio-legend">
          <div className="ratio-legend-item">
            <span className="ratio-legend-dot new"></span>
            <span>New ({newCustomers})</span>
          </div>
          <div className="ratio-legend-item">
            <span className="ratio-legend-dot returning"></span>
            <span>Returning ({returningCustomers})</span>
          </div>
        </div>
      </div>

      {/* Peak Service Times Chart */}
      {peakTimesChartData.length > 0 && (
        <div className="chart-wrapper" style={{ marginTop: '24px' }}>
          <BarChart
            data={peakTimesChartData}
            xKey="name"
            bars={[{ dataKey: 'value', color: '#8b5cf6', name: 'Requests' }]}
            title="Peak Service Times"
            height={280}
            showLegend={false}
            tooltipFormatter={(value) => `${value} requests`}
            colors={['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe', '#f5f3ff', '#faf5ff']}
          />
        </div>
      )}
    </div>
  );
};

export default CustomerSection;
