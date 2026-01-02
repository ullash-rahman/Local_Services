import React, { useMemo } from 'react';
import earningsService from '../../services/earningsService';
import './Earnings.css';

/**
 * CalendarHeatmap - Component for rendering calendar grid with color-coded earnings intensity
 * 
 * Requirements: 2.2
 * 
 * Features:
 * - Render calendar grid for a specific month
 * - Color-code days based on earnings intensity
 * - Handle click to show daily details
 */
const CalendarHeatmap = ({
    year,
    month,
    dailyData = [],
    onDayClick
}) => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const calendarData = useMemo(() => {
        const earningsMap = new Map();
        dailyData.forEach(day => {
            earningsMap.set(day.date, day);
        });

        const firstDay = new Date(year, month - 1, 1);
        const startDayOfWeek = firstDay.getDay();
        const daysInMonth = new Date(year, month, 0).getDate();
        const maxEarnings = Math.max(...dailyData.map(d => d.earnings || 0), 0);

        const weeks = [];
        let currentWeek = [];

        for (let i = 0; i < startDayOfWeek; i++) {
            currentWeek.push(null);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayData = earningsMap.get(dateStr) || { date: dateStr, earnings: 0, serviceCount: 0 };
            const intensity = earningsService.getHeatmapIntensity(dayData.earnings, maxEarnings);

            currentWeek.push({
                day,
                date: dateStr,
                earnings: dayData.earnings,
                serviceCount: dayData.serviceCount,
                intensity,
                color: earningsService.getHeatmapColor(intensity)
            });

            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
        }

        if (currentWeek.length > 0) {
            while (currentWeek.length < 7) {
                currentWeek.push(null);
            }
            weeks.push(currentWeek);
        }

        return { weeks, maxEarnings };
    }, [year, month, dailyData]);

    const handleDayClick = (dayInfo) => {
        if (dayInfo && onDayClick) {
            onDayClick(dayInfo);
        }
    };

    const isToday = (dateStr) => dateStr === earningsService.getTodayString();

    const isFuture = (dateStr) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const date = new Date(dateStr + 'T00:00:00');
        return date > today;
    };

    return (
        <div className="calendar-heatmap">
            <div className="calendar-header">
                {dayNames.map(name => (
                    <div key={name} className="calendar-day-name">{name}</div>
                ))}
            </div>

            <div className="calendar-grid">
                {calendarData.weeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="calendar-week">
                        {week.map((dayInfo, dayIndex) => (
                            <div
                                key={dayIndex}
                                className={`calendar-day ${dayInfo ? 'has-date' : 'empty'} ${
                                    dayInfo && isToday(dayInfo.date) ? 'today' : ''
                                } ${dayInfo && isFuture(dayInfo.date) ? 'future' : ''} ${
                                    dayInfo && dayInfo.earnings > 0 ? 'has-earnings' : ''
                                }`}
                                style={dayInfo ? { backgroundColor: dayInfo.color } : {}}
                                onClick={() => handleDayClick(dayInfo)}
                                title={dayInfo ? `${earningsService.formatDate(dayInfo.date)}: ${earningsService.formatCurrency(dayInfo.earnings)}` : ''}
                            >
                                {dayInfo && (
                                    <>
                                        <span className="day-number">{dayInfo.day}</span>
                                        {dayInfo.earnings > 0 && (
                                            <span className="day-earnings">
                                                {earningsService.formatCurrency(dayInfo.earnings)}
                                            </span>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            <div className="calendar-legend">
                <span className="legend-label">Less</span>
                <div className="legend-scale">
                    {[0, 0.2, 0.4, 0.7, 1].map((intensity, i) => (
                        <div
                            key={i}
                            className="legend-item"
                            style={{ backgroundColor: earningsService.getHeatmapColor(intensity) }}
                        />
                    ))}
                </div>
                <span className="legend-label">More</span>
            </div>
        </div>
    );
};

export default CalendarHeatmap;
