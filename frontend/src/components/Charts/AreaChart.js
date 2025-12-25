import React from 'react';
import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import './Charts.css';

/**
 * AreaChart component for volume trends
 * 
 * @param {Object} props
 * @param {Array} props.data - Array of data points
 * @param {string} props.xKey - Key for x-axis values
 * @param {Array} props.areas - Array of area configurations [{dataKey, color, name, fillOpacity}]
 * @param {string} props.title - Chart title
 * @param {number} props.height - Chart height (default: 300)
 * @param {boolean} props.showGrid - Show grid lines (default: true)
 * @param {boolean} props.showLegend - Show legend (default: true)
 * @param {boolean} props.stacked - Stack areas (default: false)
 * @param {boolean} props.gradient - Use gradient fill (default: true)
 * @param {string} props.xAxisLabel - Label for x-axis
 * @param {string} props.yAxisLabel - Label for y-axis
 * @param {function} props.tooltipFormatter - Custom tooltip value formatter
 */
const AreaChart = ({
  data = [],
  xKey = 'name',
  areas = [{ dataKey: 'value', color: '#8884d8', name: 'Value', fillOpacity: 0.3 }],
  title,
  height = 300,
  showGrid = true,
  showLegend = true,
  stacked = false,
  gradient = true,
  xAxisLabel,
  yAxisLabel,
  tooltipFormatter
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="chart-container chart-empty">
        <p>No data available</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <p className="chart-tooltip-label">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="chart-tooltip-value" style={{ color: entry.color }}>
              {entry.name}: {tooltipFormatter ? tooltipFormatter(entry.value) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Generate unique gradient IDs
  const gradientIds = areas.map((_, index) => `gradient-${index}-${Math.random().toString(36).substr(2, 9)}`);

  return (
    <div className="chart-container">
      {title && <h3 className="chart-title">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsAreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          {gradient && (
            <defs>
              {areas.map((area, index) => (
                <linearGradient key={gradientIds[index]} id={gradientIds[index]} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={area.color} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={area.color} stopOpacity={0.1} />
                </linearGradient>
              ))}
            </defs>
          )}
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />}
          <XAxis 
            dataKey={xKey} 
            tick={{ fontSize: 12 }}
            label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -5 } : undefined}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined}
          />
          <Tooltip content={<CustomTooltip />} />
          {showLegend && <Legend />}
          {areas.map((area, index) => (
            <Area
              key={index}
              type="monotone"
              dataKey={area.dataKey}
              stroke={area.color}
              fill={gradient ? `url(#${gradientIds[index]})` : area.color}
              fillOpacity={gradient ? 1 : (area.fillOpacity || 0.3)}
              name={area.name}
              stackId={stacked ? 'stack' : undefined}
              strokeWidth={2}
            />
          ))}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AreaChart;
