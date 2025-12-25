import React from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import './Charts.css';

/**
 * BarChart component for categorical comparisons
 * 
 * @param {Object} props
 * @param {Array} props.data - Array of data points
 * @param {string} props.xKey - Key for x-axis categories
 * @param {Array} props.bars - Array of bar configurations [{dataKey, color, name}]
 * @param {string} props.title - Chart title
 * @param {number} props.height - Chart height (default: 300)
 * @param {boolean} props.showGrid - Show grid lines (default: true)
 * @param {boolean} props.showLegend - Show legend (default: true)
 * @param {boolean} props.stacked - Stack bars (default: false)
 * @param {boolean} props.horizontal - Horizontal layout (default: false)
 * @param {Array} props.colors - Array of colors for individual bars (for single bar charts)
 * @param {function} props.tooltipFormatter - Custom tooltip value formatter
 */
const BarChart = ({
  data = [],
  xKey = 'name',
  bars = [{ dataKey: 'value', color: '#8884d8', name: 'Value' }],
  title,
  height = 300,
  showGrid = true,
  showLegend = true,
  stacked = false,
  horizontal = false,
  colors,
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

  const defaultColors = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00C49F',
    '#FFBB28', '#FF8042', '#0088FE', '#00C49F', '#FFBB28'
  ];

  return (
    <div className="chart-container">
      {title && <h3 className="chart-title">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />}
          {horizontal ? (
            <>
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey={xKey} type="category" tick={{ fontSize: 12 }} width={100} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
            </>
          )}
          <Tooltip content={<CustomTooltip />} />
          {showLegend && bars.length > 1 && <Legend />}
          {bars.map((bar, barIndex) => (
            <Bar
              key={barIndex}
              dataKey={bar.dataKey}
              fill={bar.color}
              name={bar.name}
              stackId={stacked ? 'stack' : undefined}
              radius={[4, 4, 0, 0]}
            >
              {colors && bars.length === 1 && data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length] || defaultColors[index % defaultColors.length]} />
              ))}
            </Bar>
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BarChart;
