import React from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import './Charts.css';

/**
 * LineChart component for displaying trend data
 * 
 * @param {Object} props
 * @param {Array} props.data - Array of data points with x and y values
 * @param {string} props.xKey - Key for x-axis values
 * @param {Array} props.lines - Array of line configurations [{dataKey, color, name}]
 * @param {string} props.title - Chart title
 * @param {number} props.height - Chart height (default: 300)
 * @param {boolean} props.showGrid - Show grid lines (default: true)
 * @param {boolean} props.showLegend - Show legend (default: true)
 * @param {string} props.xAxisLabel - Label for x-axis
 * @param {string} props.yAxisLabel - Label for y-axis
 * @param {function} props.tooltipFormatter - Custom tooltip value formatter
 */
const LineChart = ({
  data = [],
  xKey = 'name',
  lines = [{ dataKey: 'value', color: '#8884d8', name: 'Value' }],
  title,
  height = 300,
  showGrid = true,
  showLegend = true,
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

  return (
    <div className="chart-container">
      {title && <h3 className="chart-title">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
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
          {lines.map((line, index) => (
            <Line
              key={index}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.color}
              name={line.name}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LineChart;
