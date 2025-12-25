const pool = require('../config/database');
const { DatabaseError, ValidationError, mapDatabaseError } = require('../utils/errors');
const { analyticsLogger } = require('../utils/logger');
const RevenueAnalytics = require('./RevenueAnalytics');
const PerformanceAnalytics = require('./PerformanceAnalytics');
const CustomerAnalytics = require('./CustomerAnalytics');
const BenchmarkingService = require('./BenchmarkingService');
const fs = require('fs').promises;
const path = require('path');

// Valid report types
const REPORT_TYPES = [
    'revenue',
    'performance', 
    'customer',
    'comprehensive',
    'custom'
];

// Valid export formats
const EXPORT_FORMATS = ['pdf', 'csv', 'xlsx'];

// Valid report frequencies
const REPORT_FREQUENCIES = ['daily', 'weekly', 'monthly'];

// Report templates
const REPORT_TEMPLATES = {
    revenue: {
        name: 'Revenue Analytics Report',
        description: 'Comprehensive revenue and earnings analysis',
        sections: ['totalEarnings', 'earningsByCategory', 'revenueTrends', 'paymentStatus', 'monthlyComparison']
    },
    performance: {
        name: 'Performance Metrics Report',
        description: 'Service performance and completion analytics',
        sections: ['completionRate', 'responseTime', 'volumeTrends', 'cancellationMetrics', 'categoryMetrics']
    },
    customer: {
        name: 'Customer Analytics Report',
        description: 'Customer insights and behavior analysis',
        sections: ['uniqueCustomers', 'retentionRate', 'geographicDistribution', 'peakTimes', 'acquisitionTrends']
    },
    comprehensive: {
        name: 'Comprehensive Analytics Report',
        description: 'Complete business performance overview',
        sections: ['revenue', 'performance', 'customer', 'benchmarks']
    },
    custom: {
        name: 'Custom Report',
        description: 'User-defined report with selected metrics',
        sections: []
    }
};

class ReportGenerator {
    static validateReportOptions(options) {
        if (!options) {
            throw new ValidationError('Report options are required');
        }

        if (options.reportType && !REPORT_TYPES.includes(options.reportType)) {
            throw new ValidationError(`Invalid report type. Must be one of: ${REPORT_TYPES.join(', ')}`);
        }

        if (options.format && !EXPORT_FORMATS.includes(options.format)) {
            throw new ValidationError(`Invalid format. Must be one of: ${EXPORT_FORMATS.join(', ')}`);
        }

        if (options.dateRangeStart && options.dateRangeEnd) {
            const startDate = new Date(options.dateRangeStart);
            const endDate = new Date(options.dateRangeEnd);
            
            if (startDate > endDate) {
                throw new ValidationError('Start date must be before end date');
            }
        }
    }

    static validateSchedule(schedule) {
        if (!schedule) {
            throw new ValidationError('Schedule configuration is required');
        }

        if (!REPORT_FREQUENCIES.includes(schedule.frequency)) {
            throw new ValidationError(`Invalid frequency. Must be one of: ${REPORT_FREQUENCIES.join(', ')}`);
        }

        if (schedule.emailRecipients && !Array.isArray(schedule.emailRecipients)) {
            throw new ValidationError('Email recipients must be an array');
        }
    }

    static async generateAnalyticsData(providerID, options) {
        try {
            const { reportType, dateRangeStart, dateRangeEnd, sections } = options;
            
            // Determine period based on date range
            let period = '30days';
            if (dateRangeStart && dateRangeEnd) {
                const start = new Date(dateRangeStart);
                const end = new Date(dateRangeEnd);
                const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
                
                if (daysDiff <= 7) period = '7days';
                else if (daysDiff <= 30) period = '30days';
                else if (daysDiff <= 180) period = '6months';
                else period = '1year';
            }

            const data = {
                reportType,
                period,
                dateRange: {
                    start: dateRangeStart,
                    end: dateRangeEnd
                },
                generatedAt: new Date().toISOString()
            };

            // Generate data based on report type and sections
            switch (reportType) {
                case 'revenue':
                    data.revenue = await RevenueAnalytics.getDashboardData(providerID, period);
                    break;
                    
                case 'performance':
                    data.performance = await PerformanceAnalytics.getDashboardData(providerID, period);
                    break;
                    
                case 'customer':
                    data.customer = {
                        uniqueCustomers: await CustomerAnalytics.getUniqueCustomerCount(providerID, period),
                        retentionRate: await CustomerAnalytics.getRetentionRate(providerID),
                        geographicDistribution: await CustomerAnalytics.getGeographicDistribution(providerID),
                        peakTimes: await CustomerAnalytics.getPeakServiceTimes(providerID),
                        acquisitionTrends: await CustomerAnalytics.getAcquisitionTrends(providerID, period),
                        lifetimeValue: await CustomerAnalytics.getCustomerLifetimeValue(providerID)
                    };
                    break;
                    
                case 'comprehensive':
                    const [revenue, performance, customer, benchmarks] = await Promise.all([
                        RevenueAnalytics.getDashboardData(providerID, period),
                        PerformanceAnalytics.getDashboardData(providerID, period),
                        CustomerAnalytics.getUniqueCustomerCount(providerID, period),
                        BenchmarkingService.getPercentileRankings(providerID)
                    ]);
                    
                    data.revenue = revenue;
                    data.performance = performance;
                    data.customer = customer;
                    data.benchmarks = benchmarks;
                    break;
                    
                case 'custom':
                    if (sections && sections.includes('revenue')) {
                        data.revenue = await RevenueAnalytics.getDashboardData(providerID, period);
                    }
                    if (sections && sections.includes('performance')) {
                        data.performance = await PerformanceAnalytics.getDashboardData(providerID, period);
                    }
                    if (sections && sections.includes('customer')) {
                        data.customer = await CustomerAnalytics.getUniqueCustomerCount(providerID, period);
                    }
                    if (sections && sections.includes('benchmarks')) {
                        data.benchmarks = await BenchmarkingService.getPercentileRankings(providerID);
                    }
                    break;
                    
                default:
                    throw new ValidationError(`Unsupported report type: ${reportType}`);
            }

            return data;
        } catch (error) {
            analyticsLogger.error('Error generating analytics data', { providerID, options, error: error.message });
            throw error;
        }
    }

    static async generateReport(providerID, options = {}) {
        try {
            this.validateReportOptions(options);
            analyticsLogger.debug('Generating report', { providerID, options });

            const {
                reportType = 'comprehensive',
                format = 'pdf',
                dateRangeStart,
                dateRangeEnd,
                sections,
                includeCharts = true,
                includeSummary = true
            } = options;

            // Generate analytics data
            const analyticsData = await this.generateAnalyticsData(providerID, {
                reportType,
                dateRangeStart,
                dateRangeEnd,
                sections
            });

            // Create report metadata
            const reportMetadata = {
                reportID: null, // Will be set after database insert
                providerID,
                reportType,
                format,
                dateRange: {
                    start: dateRangeStart,
                    end: dateRangeEnd
                },
                options: {
                    sections,
                    includeCharts,
                    includeSummary
                },
                generatedAt: new Date().toISOString(),
                status: 'generated'
            };

            // Save report to database
            const insertQuery = `
                INSERT INTO GeneratedReport (
                    providerID, reportType, dateRangeStart, dateRangeEnd, 
                    fileFormat, generatedAt, expiresAt
                ) VALUES (?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))
            `;

            const startDate = dateRangeStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const endDate = dateRangeEnd || new Date().toISOString().split('T')[0];

            const [result] = await pool.execute(insertQuery, [
                providerID,
                reportType,
                startDate,
                endDate,
                format
            ]);

            reportMetadata.reportID = result.insertId;

            return {
                reportMetadata,
                analyticsData,
                template: REPORT_TEMPLATES[reportType] || REPORT_TEMPLATES.custom
            };
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error generating report', { providerID, options, error: error.message });
            throw mapDatabaseError(error);
        }
    }

    static async exportData(providerID, format, options = {}) {
        try {
            if (!EXPORT_FORMATS.includes(format)) {
                throw new ValidationError(`Invalid format. Must be one of: ${EXPORT_FORMATS.join(', ')}`);
            }

            analyticsLogger.debug('Exporting data', { providerID, format, options });

            // Generate the report data
            const reportData = await this.generateReport(providerID, {
                ...options,
                format
            });

            // Create export directory if it doesn't exist
            const exportDir = path.join(process.cwd(), 'exports', 'reports');
            await fs.mkdir(exportDir, { recursive: true });

            // Generate filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `report_${providerID}_${timestamp}.${format}`;
            const filePath = path.join(exportDir, filename);

            let exportResult;

            switch (format) {
                case 'csv':
                    exportResult = await this.exportToCSV(reportData, filePath);
                    break;
                case 'xlsx':
                    exportResult = await this.exportToExcel(reportData, filePath);
                    break;
                case 'pdf':
                    exportResult = await this.exportToPDF(reportData, filePath);
                    break;
                default:
                    throw new ValidationError(`Unsupported export format: ${format}`);
            }

            // Update database with file path
            const updateQuery = `
                UPDATE GeneratedReport 
                SET filePath = ? 
                WHERE reportID = ?
            `;
            await pool.execute(updateQuery, [filePath, reportData.reportMetadata.reportID]);

            return {
                reportID: reportData.reportMetadata.reportID,
                filePath,
                filename,
                format,
                size: exportResult.size,
                generatedAt: reportData.reportMetadata.generatedAt,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            };
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error exporting data', { providerID, format, options, error: error.message });
            throw mapDatabaseError(error);
        }
    }

    static async exportToCSV(reportData, filePath) {
        try {
            const { analyticsData } = reportData;
            let csvContent = '';

            // Add header
            csvContent += `Provider Analytics Report - ${analyticsData.reportType}\n`;
            csvContent += `Generated: ${analyticsData.generatedAt}\n`;
            csvContent += `Period: ${analyticsData.period}\n\n`;

            // Export revenue data if available
            if (analyticsData.revenue) {
                csvContent += 'REVENUE ANALYTICS\n';
                csvContent += 'Metric,Value,Period\n';
                
                const revenue = analyticsData.revenue;
                if (revenue.totalEarnings) {
                    csvContent += `Total Earnings,${revenue.totalEarnings.currentPeriod.totalEarnings},${revenue.totalEarnings.period}\n`;
                }
                
                if (revenue.earningsByCategory && revenue.earningsByCategory.categories) {
                    csvContent += '\nEarnings by Category\n';
                    csvContent += 'Category,Earnings,Service Count,Percentage\n';
                    revenue.earningsByCategory.categories.forEach(cat => {
                        csvContent += `${cat.category},${cat.earnings},${cat.serviceCount},${cat.percentage}%\n`;
                    });
                }
                csvContent += '\n';
            }

            // Export performance data if available
            if (analyticsData.performance) {
                csvContent += 'PERFORMANCE ANALYTICS\n';
                csvContent += 'Metric,Value,Period\n';
                
                const perf = analyticsData.performance;
                if (perf.completionRate) {
                    csvContent += `Completion Rate,${perf.completionRate.completionRate}%,${perf.completionRate.period}\n`;
                }
                if (perf.averageResponseTime) {
                    csvContent += `Average Response Time,${perf.averageResponseTime.averageResponseTime.formatted},${perf.averageResponseTime.period}\n`;
                }
                csvContent += '\n';
            }

            // Write to file
            await fs.writeFile(filePath, csvContent, 'utf8');
            const stats = await fs.stat(filePath);

            return {
                success: true,
                size: stats.size,
                rows: csvContent.split('\n').length
            };
        } catch (error) {
            analyticsLogger.error('Error exporting to CSV', { filePath, error: error.message });
            throw new Error(`CSV export failed: ${error.message}`);
        }
    }

    static async exportToExcel(reportData, filePath) {
        try {
            // For now, create a simple text-based Excel-compatible format
            // In a real implementation, you would use a library like 'xlsx' or 'exceljs'
            const { analyticsData } = reportData;
            let content = '';

            content += `Provider Analytics Report\t${analyticsData.reportType}\n`;
            content += `Generated\t${analyticsData.generatedAt}\n`;
            content += `Period\t${analyticsData.period}\n\n`;

            // Add revenue data
            if (analyticsData.revenue) {
                content += 'REVENUE ANALYTICS\n';
                content += 'Metric\tValue\tPeriod\n';
                
                const revenue = analyticsData.revenue;
                if (revenue.totalEarnings) {
                    content += `Total Earnings\t${revenue.totalEarnings.currentPeriod.totalEarnings}\t${revenue.totalEarnings.period}\n`;
                }
                content += '\n';
            }

            // Write to file
            await fs.writeFile(filePath, content, 'utf8');
            const stats = await fs.stat(filePath);

            return {
                success: true,
                size: stats.size,
                sheets: 1
            };
        } catch (error) {
            analyticsLogger.error('Error exporting to Excel', { filePath, error: error.message });
            throw new Error(`Excel export failed: ${error.message}`);
        }
    }

    static async exportToPDF(reportData, filePath) {
        try {
            // For now, create a simple text-based PDF-compatible format
            // In a real implementation, you would use a library like 'pdfkit' or 'puppeteer'
            const { analyticsData, template } = reportData;
            let content = '';

            content += `PROVIDER ANALYTICS REPORT\n`;
            content += `${template.name}\n`;
            content += `Generated: ${analyticsData.generatedAt}\n`;
            content += `Period: ${analyticsData.period}\n\n`;

            content += `${template.description}\n\n`;

            // Add summary sections
            if (analyticsData.revenue) {
                content += 'REVENUE SUMMARY\n';
                content += '================\n';
                const revenue = analyticsData.revenue;
                if (revenue.totalEarnings) {
                    content += `Total Earnings: $${revenue.totalEarnings.currentPeriod.formattedEarnings}\n`;
                    if (revenue.totalEarnings.percentageChange !== null) {
                        content += `Change from Previous Period: ${revenue.totalEarnings.percentageChange}%\n`;
                    }
                }
                content += '\n';
            }

            if (analyticsData.performance) {
                content += 'PERFORMANCE SUMMARY\n';
                content += '===================\n';
                const perf = analyticsData.performance;
                if (perf.completionRate) {
                    content += `Completion Rate: ${perf.completionRate.completionRate}%\n`;
                }
                if (perf.averageResponseTime) {
                    content += `Average Response Time: ${perf.averageResponseTime.averageResponseTime.formatted}\n`;
                }
                content += '\n';
            }

            // Write to file
            await fs.writeFile(filePath, content, 'utf8');
            const stats = await fs.stat(filePath);

            return {
                success: true,
                size: stats.size,
                pages: Math.ceil(content.length / 3000) // Rough estimate
            };
        } catch (error) {
            analyticsLogger.error('Error exporting to PDF', { filePath, error: error.message });
            throw new Error(`PDF export failed: ${error.message}`);
        }
    }

    static async scheduleReport(providerID, schedule, options = {}) {
        try {
            this.validateSchedule(schedule);
            this.validateReportOptions(options);
            analyticsLogger.debug('Scheduling report', { providerID, schedule, options });

            const {
                frequency,
                emailRecipients = [],
                startDate,
                isActive = true
            } = schedule;

            // Calculate next run date based on frequency
            let nextRunDate = new Date();
            if (startDate) {
                nextRunDate = new Date(startDate);
            }

            switch (frequency) {
                case 'daily':
                    nextRunDate.setDate(nextRunDate.getDate() + 1);
                    break;
                case 'weekly':
                    nextRunDate.setDate(nextRunDate.getDate() + 7);
                    break;
                case 'monthly':
                    nextRunDate.setMonth(nextRunDate.getMonth() + 1);
                    break;
            }

            const insertQuery = `
                INSERT INTO ScheduledReport (
                    providerID, reportType, frequency, nextRunDate,
                    emailRecipients, reportOptions, isActive
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            const [result] = await pool.execute(insertQuery, [
                providerID,
                options.reportType || 'comprehensive',
                frequency,
                nextRunDate.toISOString().slice(0, 19).replace('T', ' '),
                JSON.stringify(emailRecipients),
                JSON.stringify(options),
                isActive
            ]);

            return {
                scheduleID: result.insertId,
                providerID,
                reportType: options.reportType || 'comprehensive',
                frequency,
                nextRunDate: nextRunDate.toISOString(),
                emailRecipients,
                reportOptions: options,
                isActive,
                createdAt: new Date().toISOString()
            };
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error scheduling report', { providerID, schedule, options, error: error.message });
            throw mapDatabaseError(error);
        }
    }

    static async getTemplates() {
        try {
            analyticsLogger.debug('Getting report templates');

            // Return predefined templates with additional metadata
            const templates = Object.entries(REPORT_TEMPLATES).map(([key, template]) => ({
                templateID: key,
                ...template,
                supportedFormats: EXPORT_FORMATS,
                estimatedGenerationTime: this.getEstimatedGenerationTime(key)
            }));

            return {
                templates,
                totalCount: templates.length,
                supportedFormats: EXPORT_FORMATS,
                supportedFrequencies: REPORT_FREQUENCIES
            };
        } catch (error) {
            analyticsLogger.error('Error getting templates', { error: error.message });
            throw mapDatabaseError(error);
        }
    }

    static getEstimatedGenerationTime(templateID) {
        const times = {
            revenue: '2-3 minutes',
            performance: '2-3 minutes',
            customer: '1-2 minutes',
            comprehensive: '5-7 minutes',
            custom: '1-5 minutes'
        };
        return times[templateID] || '1-3 minutes';
    }

    static async getReportHistory(providerID, options = {}) {
        try {
            analyticsLogger.debug('Getting report history', { providerID, options });

            const {
                limit = 50,
                offset = 0,
                reportType,
                format,
                startDate,
                endDate
            } = options;

            // Build query conditions
            let whereConditions = ['gr.providerID = ?'];
            let queryParams = [providerID];

            if (reportType) {
                whereConditions.push('gr.reportType = ?');
                queryParams.push(reportType);
            }

            if (format) {
                whereConditions.push('gr.fileFormat = ?');
                queryParams.push(format);
            }

            if (startDate) {
                whereConditions.push('gr.generatedAt >= ?');
                queryParams.push(startDate);
            }

            if (endDate) {
                whereConditions.push('gr.generatedAt <= ?');
                queryParams.push(endDate);
            }

            const whereClause = whereConditions.join(' AND ');

            // Get total count
            const countQuery = `
                SELECT COUNT(*) as totalCount
                FROM GeneratedReport gr
                WHERE ${whereClause}
            `;

            const [countRows] = await pool.execute(countQuery, queryParams);
            const totalCount = parseInt(countRows[0].totalCount, 10);

            // Get reports with pagination
            const reportsQuery = `
                SELECT 
                    gr.reportID,
                    gr.reportType,
                    gr.dateRangeStart,
                    gr.dateRangeEnd,
                    gr.filePath,
                    gr.fileFormat,
                    gr.generatedAt,
                    gr.expiresAt,
                    CASE 
                        WHEN gr.expiresAt < NOW() THEN 'expired'
                        WHEN gr.filePath IS NOT NULL THEN 'available'
                        ELSE 'generating'
                    END as status
                FROM GeneratedReport gr
                WHERE ${whereClause}
                ORDER BY gr.generatedAt DESC
                LIMIT ? OFFSET ?
            `;

            queryParams.push(limit, offset);
            const [reportRows] = await pool.execute(reportsQuery, queryParams);

            const reports = reportRows.map(row => ({
                reportID: row.reportID,
                reportType: row.reportType,
                dateRange: {
                    start: row.dateRangeStart,
                    end: row.dateRangeEnd
                },
                filePath: row.filePath,
                format: row.fileFormat,
                generatedAt: row.generatedAt,
                expiresAt: row.expiresAt,
                status: row.status,
                isExpired: row.status === 'expired',
                isAvailable: row.status === 'available',
                template: REPORT_TEMPLATES[row.reportType] || REPORT_TEMPLATES.custom
            }));

            // Get scheduled reports
            const scheduledQuery = `
                SELECT 
                    sr.scheduleID,
                    sr.reportType,
                    sr.frequency,
                    sr.nextRunDate,
                    sr.lastRunDate,
                    sr.isActive
                FROM ScheduledReport sr
                WHERE sr.providerID = ? AND sr.isActive = true
                ORDER BY sr.nextRunDate ASC
            `;

            const [scheduledRows] = await pool.execute(scheduledQuery, [providerID]);
            const scheduledReports = scheduledRows.map(row => ({
                scheduleID: row.scheduleID,
                reportType: row.reportType,
                frequency: row.frequency,
                nextRunDate: row.nextRunDate,
                lastRunDate: row.lastRunDate,
                isActive: Boolean(row.isActive)
            }));

            return {
                reports,
                scheduledReports,
                pagination: {
                    totalCount,
                    limit,
                    offset,
                    hasMore: offset + limit < totalCount,
                    currentPage: Math.floor(offset / limit) + 1,
                    totalPages: Math.ceil(totalCount / limit)
                },
                summary: {
                    totalReports: totalCount,
                    availableReports: reports.filter(r => r.isAvailable).length,
                    expiredReports: reports.filter(r => r.isExpired).length,
                    activeSchedules: scheduledReports.length
                }
            };
        } catch (error) {
            analyticsLogger.error('Error getting report history', { providerID, options, error: error.message });
            throw mapDatabaseError(error);
        }
    }

    static async cancelScheduledReport(scheduleID, providerID) {
        try {
            analyticsLogger.debug('Cancelling scheduled report', { scheduleID, providerID });

            const updateQuery = `
                UPDATE ScheduledReport 
                SET isActive = false, updatedAt = NOW()
                WHERE scheduleID = ? AND providerID = ?
            `;

            const [result] = await pool.execute(updateQuery, [scheduleID, providerID]);

            if (result.affectedRows === 0) {
                throw new ValidationError('Scheduled report not found or access denied');
            }

            return {
                scheduleID,
                cancelled: true,
                cancelledAt: new Date().toISOString()
            };
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error cancelling scheduled report', { scheduleID, providerID, error: error.message });
            throw mapDatabaseError(error);
        }
    }

    static async getDashboardData(providerID) {
        try {
            analyticsLogger.debug('Getting report generator dashboard data', { providerID });

            const [templates, history] = await Promise.all([
                this.getTemplates(),
                this.getReportHistory(providerID, { limit: 10 })
            ]);

            return {
                templates,
                recentReports: history.reports.slice(0, 5),
                scheduledReports: history.scheduledReports,
                summary: history.summary,
                generatedAt: new Date().toISOString()
            };
        } catch (error) {
            analyticsLogger.error('Error getting report generator dashboard', { providerID, error: error.message });
            throw error;
        }
    }
}

module.exports = ReportGenerator;
