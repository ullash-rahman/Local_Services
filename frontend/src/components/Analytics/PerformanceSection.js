import analyticsService from '../../services/analyticsService';
import LineChart from '../Charts/LineChart';
import BarChart from '../Charts/BarChart';

const PerformanceSection = ({ data, period }) => {
  // Handle empty/loading state
  if (!data) {
    return (
      <div className="performance-section">
        <div className="section-header">
          <h2 className="section-title">Performance Metrics</h2>
        </div>
        <div className="empty-state">
          <span className="empty-state-icon">📊</span>
          <p className="empty-state-text">No performance data available</p>
        </div>
      </div>
    );
  }

  // Extract data from backend response format (getPerformanceSummary returns rates object)
  const rates = data.rates || {};
  const completionRate = rates.completionRate || data.completionRate?.completionRate || 0;
  const previousCompletionRate = data.completionRate?.previousPeriod?.completionRate || 0;

  // Response time from requestMetrics or responseTime object
  const responseTimeData = data.responseTime || data.averageResponseTime || {};
  const averageResponseTime = responseTimeData.averageResponseTime?.minutes || responseTimeData.minutes || 0;
  const previousResponseTime = responseTimeData.previousPeriod?.minutes || 0;

  // Cancellation data
  const cancellationRate = rates.cancellationRate || data.cancellationMetrics?.cancellationRate || 0;
  const cancellationReasons = data.cancellationMetrics?.reasons || [];

  // Volume trends
  const volumeTrends = data.volumeTrends?.dataPoints || data.requestVolumeTrends?.dataPoints || [];

  // Calculate changes
  const completionChange = analyticsService.calculateChange(completionRate, previousCompletionRate);
  const responseTimeChange = analyticsService.calculateChange(averageResponseTime, previousResponseTime);

  // Format volume trend data for chart
  const volumeData = volumeTrends.map(item => ({
    name: item.label || item.date,
    value: parseInt(item.count || item.requestCount || item.value) || 0
  }));

  // Format cancellation reasons for bar chart
  const reasonsData = cancellationReasons.map(item => ({
    name: item.reason || item.name,
    value: parseInt(item.count || item.value) || 0
  }));

  // Determine if response time improvement is good (lower is better)
  const responseTimeDirection = responseTimeChange.direction === 'down' ? 'positive' : 
                                responseTimeChange.direction === 'up' ? 'negative' : 'neutral';

  return (
    <div className="performance-section">
      <div className="section-header">
        <div>
          <h2 className="section-title">Performance Metrics</h2>
          <p className="section-subtitle">
            Monitor your service quality and efficiency
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <p className="metric-label">Completion Rate</p>
          <p className="metric-value">
            {analyticsService.formatPercentage(completionRate)}
          </p>
          <div className={`metric-change ${completionChange.direction === 'up' ? 'positive' : completionChange.direction === 'down' ? 'negative' : 'neutral'}`}>
            <span className="change-icon">
              {completionChange.direction === 'up' ? '↑' : completionChange.direction === 'down' ? '↓' : '→'}
            </span>
            <span>{completionChange.value}% vs previous period</span>
          </div>
        </div>

        <div className="metric-card">
          <p className="metric-label">Avg Response Time</p>
          <p className="metric-value">
            {analyticsService.formatDuration(averageResponseTime)}
          </p>
          <div className={`metric-change ${responseTimeDirection}`}>
            <span className="change-icon">
              {responseTimeChange.direction === 'up' ? '↑' : responseTimeChange.direction === 'down' ? '↓' : '→'}
            </span>
            <span>{responseTimeChange.value}% vs previous period</span>
          </div>
        </div>

        <div className="metric-card">
          <p className="metric-label">Cancellation Rate</p>
          <p className="metric-value">
            {analyticsService.formatPercentage(cancellationRate)}
          </p>
          <div className="metric-change neutral">
            <span>{analyticsService.getPeriodLabel(period)}</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      {(volumeData.length > 0 || reasonsData.length > 0) && (
        <div className="charts-grid">
          {/* Request Volume Trend */}
          {volumeData.length > 0 && (
            <div className="chart-wrapper">
              <LineChart
                data={volumeData}
                xKey="name"
                lines={[{ dataKey: 'value', color: '#22c55e', name: 'Requests' }]}
                title="Request Volume Trend"
                height={280}
                tooltipFormatter={(value) => `${value} requests`}
              />
            </div>
          )}

          {/* Cancellation Reasons */}
          {reasonsData.length > 0 && (
            <div className="chart-wrapper">
              <BarChart
                data={reasonsData}
                xKey="name"
                bars={[{ dataKey: 'value', color: '#ef4444', name: 'Count' }]}
                title="Cancellation Reasons"
                height={280}
                horizontal={true}
                showLegend={false}
                tooltipFormatter={(value) => `${value} cancellations`}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PerformanceSection;
