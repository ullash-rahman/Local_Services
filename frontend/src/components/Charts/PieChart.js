import React, { useState } from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Sector
} from 'recharts';
import './Charts.css';

/**
 * PieChart component for percentage-based data
 * 
 * @param {Object} props
 * @param {Array} props.data - Array of data points with name and value
 * @param {string} props.dataKey - Key for values (default: 'value')
 * @param {string} props.nameKey - Key for names (default: 'name')
 * @param {string} props.title - Chart title
 * @param {number} props.height - Chart height (default: 300)
 * @param {boolean} props.showLegend - Show legend (default: true)
 * @param {boolean} props.showLabels - Show labels on slices (default: false)
 * @param {boolean} props.donut - Render as donut chart (default: false)
 * @param {Array} props.colors - Custom colors array
 * @param {function} props.tooltipFormatter - Custom tooltip value formatter
 */
const PieChart = ({
  data = [],
  dataKey = 'value',
  nameKey = 'name',
  title,
  height = 300,
  showLegend = true,
  showLabels = false,
  donut = false,
  colors,
  tooltipFormatter
}) => {
  const [activeIndex, setActiveIndex] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="chart-container chart-empty">
        <p>No data available</p>
      </div>
    );
  }

  const defaultColors = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00C49F',
    '#FFBB28', '#FF8042', '#0088FE', '#a4de6c', '#d0ed57'
  ];

  const chartColors = colors || defaultColors;

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      // Safely get total - use the pre-calculated total from dataWithTotal
      const total = data?.payload?.total || 0;
      const percentage = total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;
      
      return (
        <div className="chart-tooltip">
          <p className="chart-tooltip-label">{data.name}</p>
          <p className="chart-tooltip-value" style={{ color: data?.payload?.fill || '#333' }}>
            {tooltipFormatter ? tooltipFormatter(data.value) : data.value}
            {total > 0 && ` (${percentage}%)`}
          </p>
        </div>
      );
    }
    return null;
  };

  const renderActiveShape = (props) => {
    const {
      cx, cy, innerRadius, outerRadius, startAngle, endAngle,
      fill, payload, value
    } = props;

    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 6}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
        {donut && (
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" className="pie-center-text">
            <tspan x={cx} dy="-0.5em" fontSize="14" fontWeight="bold">{payload[nameKey]}</tspan>
            <tspan x={cx} dy="1.5em" fontSize="12">{tooltipFormatter ? tooltipFormatter(value) : value}</tspan>
          </text>
        )}
      </g>
    );
  };

  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null; // Don't show labels for very small slices

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // Calculate total for percentage display
  const total = data.reduce((sum, item) => sum + item[dataKey], 0);
  const dataWithTotal = data.map(item => ({ ...item, total }));

  return (
    <div className="chart-container">
      {title && <h3 className="chart-title">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsPieChart>
          <Pie
            data={dataWithTotal}
            dataKey={dataKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            innerRadius={donut ? 60 : 0}
            outerRadius={80}
            paddingAngle={2}
            activeIndex={activeIndex}
            activeShape={renderActiveShape}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            label={showLabels ? renderLabel : false}
            labelLine={false}
          >
            {dataWithTotal.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={chartColors[index % chartColors.length]}
                stroke="#fff"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          {showLegend && (
            <Legend 
              layout="horizontal" 
              verticalAlign="bottom" 
              align="center"
              formatter={(value, entry) => (
                <span style={{ color: '#333', fontSize: 12 }}>{value}</span>
              )}
            />
          )}
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PieChart;
