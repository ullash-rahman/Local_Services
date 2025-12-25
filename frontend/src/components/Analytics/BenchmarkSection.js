import analyticsService from '../../services/analyticsService';

const BenchmarkSection = ({ data }) => {
  // Handle empty/loading state
  if (!data) {
    return (
      <div className="benchmark-section">
        <div className="section-header">
          <h2 className="section-title">Performance Benchmarks</h2>
        </div>
        <div className="empty-state">
          <span className="empty-state-icon">📈</span>
          <p className="empty-state-text">No benchmark data available</p>
        </div>
      </div>
    );
  }

  // Extract data from backend response format
  // Backend returns: platformAverages (object with metrics), percentileRankings (object with rankings), improvementSuggestions (array)
  const platformAverages = data.platformAverages?.metrics || {};
  const percentileRankingsData = data.percentileRankings?.rankings || data.percentileRankings || {};
  const suggestions = data.improvementSuggestions || data.suggestions || [];

  // Build comparisons array from platform averages and percentile rankings
  const comparisons = [];
  
  // Add completion rate comparison
  if (platformAverages.completionRate && percentileRankingsData.completionRate) {
    comparisons.push({
      metric: 'Completion Rate',
      providerValue: percentileRankingsData.completionRate.value || 0,
      platformAverage: platformAverages.completionRate.value || 0
    });
  }
  
  // Add response time comparison
  if (platformAverages.responseTime && percentileRankingsData.responseTime) {
    comparisons.push({
      metric: 'Response Time',
      providerValue: percentileRankingsData.responseTime.value || 0,
      platformAverage: platformAverages.responseTime.value || 0
    });
  }
  
  // Add customer satisfaction comparison
  if (platformAverages.customerSatisfaction && percentileRankingsData.customerSatisfaction) {
    comparisons.push({
      metric: 'Customer Satisfaction',
      providerValue: percentileRankingsData.customerSatisfaction.value || 0,
      platformAverage: platformAverages.customerSatisfaction.value || 0
    });
  }
  
  // Add cancellation rate comparison
  if (platformAverages.cancellationRate && percentileRankingsData.cancellationRate) {
    comparisons.push({
      metric: 'Cancellation Rate',
      providerValue: percentileRankingsData.cancellationRate.value || 0,
      platformAverage: platformAverages.cancellationRate.value || 0
    });
  }

  // Build percentile rankings object for display
  const percentileRankings = {};
  if (percentileRankingsData.completionRate?.percentile !== undefined) {
    percentileRankings['Completion Rate'] = percentileRankingsData.completionRate.percentile;
  }
  if (percentileRankingsData.responseTime?.percentile !== undefined) {
    percentileRankings['Response Time'] = percentileRankingsData.responseTime.percentile;
  }
  if (percentileRankingsData.customerSatisfaction?.percentile !== undefined) {
    percentileRankings['Customer Satisfaction'] = percentileRankingsData.customerSatisfaction.percentile;
  }
  if (percentileRankingsData.cancellationRate?.percentile !== undefined) {
    percentileRankings['Cancellation Rate'] = percentileRankingsData.cancellationRate.percentile;
  }

  // Helper to get status label
  const getStatusLabel = (status) => {
    switch (status) {
      case 'above': return 'Above Avg';
      case 'below': return 'Below Avg';
      default: return 'Average';
    }
  };

  // Format comparison metrics
  const formattedComparisons = comparisons.map(item => {
    const status = analyticsService.getBenchmarkStatus(item.providerValue, item.platformAverage);
    return {
      ...item,
      status,
      formattedProviderValue: formatMetricValue(item.metric, item.providerValue),
      formattedPlatformValue: formatMetricValue(item.metric, item.platformAverage)
    };
  });

  // Helper to format metric values based on type
  function formatMetricValue(metric, value) {
    const metricLower = (metric || '').toLowerCase();
    if (metricLower.includes('rate') || metricLower.includes('percentage')) {
      return analyticsService.formatPercentage(value);
    }
    if (metricLower.includes('earning') || metricLower.includes('revenue') || metricLower.includes('price')) {
      return analyticsService.formatCurrency(value);
    }
    if (metricLower.includes('time') || metricLower.includes('response')) {
      return analyticsService.formatDuration(value);
    }
    return value?.toLocaleString() || '0';
  }

  return (
    <div className="benchmark-section">
      <div className="section-header">
        <div>
          <h2 className="section-title">Performance Benchmarks</h2>
          <p className="section-subtitle">
            Compare your performance against platform averages
          </p>
        </div>
      </div>

      {/* Benchmark Comparisons */}
      {formattedComparisons.length > 0 && (
        <div className="benchmark-list">
          {formattedComparisons.map((item, index) => (
            <div key={index} className="benchmark-item">
              <div className="benchmark-metric">
                <p className="benchmark-metric-name">{item.metric}</p>
                <div className="benchmark-values">
                  <span className="benchmark-your-value">
                    You: {item.formattedProviderValue}
                  </span>
                  <span className="benchmark-platform-value">
                    Platform Avg: {item.formattedPlatformValue}
                  </span>
                </div>
              </div>
              <span className={`benchmark-status ${item.status}`}>
                {getStatusLabel(item.status)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Percentile Rankings */}
      {Object.keys(percentileRankings).length > 0 && (
        <div className="percentile-grid">
          {Object.entries(percentileRankings).map(([metric, percentile], index) => (
            <div key={index} className="percentile-item">
              <p className="percentile-value">
                {typeof percentile === 'number' ? `${Math.round(percentile)}th` : percentile}
              </p>
              <p className="percentile-label">{formatMetricLabel(metric)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Improvement Suggestions */}
      {suggestions.length > 0 && (
        <div className="suggestions-list">
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#333' }}>
            Improvement Suggestions
          </h3>
          {suggestions.map((suggestion, index) => (
            <div key={index} className="suggestion-item">
              <span className="suggestion-icon">💡</span>
              <p className="suggestion-text">
                {typeof suggestion === 'string' ? suggestion : suggestion.text || suggestion.message}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Empty state for no comparisons */}
      {formattedComparisons.length === 0 && Object.keys(percentileRankings).length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon">📊</span>
          <p className="empty-state-text">
            Complete more services to see how you compare to other providers
          </p>
        </div>
      )}
    </div>
  );
};

// Helper to format metric labels for display
function formatMetricLabel(metric) {
  return metric
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

export default BenchmarkSection;
