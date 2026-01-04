const pool = require('../config/database');
const { DatabaseError, ValidationError, mapDatabaseError } = require('../utils/errors');
const { analyticsLogger } = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * EarningsExportService - Service for generating earnings data exports
 * for the Daily/Monthly Earnings Dashboard feature.
 */
class EarningsExportService {
    /**
     * Validate date format (YYYY-MM-DD)
     * @param {string} date - Date string to validate
     * @returns {boolean} True if valid
     */
    static isValidDateFormat(date) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) return false;
        const parsed = new Date(date);
        return !isNaN(parsed.getTime());
    }

    /**
     * Escape a value for CSV format
     * @param {any} value - Value to escape
     * @returns {string} Escaped CSV value
     */
    static escapeCSVValue(value) {
        if (value === null || value === undefined) {
            return '';
        }
        const stringValue = String(value);
        // If value contains comma, quote, or newline, wrap in quotes and escape quotes
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    }

    /**
     * Generate CSV export of earnings data
     * @param {number} providerID - Provider's user ID
     * @param {string} startDate - Start date in YYYY-MM-DD format
     * @param {string} endDate - End date in YYYY-MM-DD format
     * @param {string[]} categories - Optional category filter
     * @returns {Promise<ExportResult>} Export file path and metadata
     */
    static async generateCSVExport(providerID, startDate, endDate, categories = []) {
        try {
            // Validate inputs
            if (!providerID || isNaN(parseInt(providerID))) {
                throw new ValidationError('Invalid provider ID format');
            }

            if (!startDate || !this.isValidDateFormat(startDate)) {
                throw new ValidationError('Start date must be in YYYY-MM-DD format');
            }

            if (!endDate || !this.isValidDateFormat(endDate)) {
                throw new ValidationError('End date must be in YYYY-MM-DD format');
            }

            if (new Date(startDate) > new Date(endDate)) {
                throw new ValidationError('Start date must be before or equal to end date');
            }

            analyticsLogger.debug('Generating CSV export', { providerID, startDate, endDate, categories });

            // Build category filter condition
            let categoryCondition = '';
            const params = [providerID, startDate, endDate];
            
            if (categories && categories.length > 0) {
                const placeholders = categories.map(() => '?').join(', ');
                categoryCondition = `AND sr.category IN (${placeholders})`;
                params.push(...categories);
            }

            // Query for earnings data with date, amount, category, and service count
            const query = `
                SELECT 
                    DATE(p.paymentDate) as date,
                    p.amount,
                    sr.category,
                    COUNT(DISTINCT sr.requestID) as serviceCount
                FROM Payment p
                JOIN ServiceRequest sr ON p.requestID = sr.requestID
                WHERE sr.providerID = ?
                    AND p.status = 'Completed'
                    AND DATE(p.paymentDate) >= ?
                    AND DATE(p.paymentDate) <= ?
                    ${categoryCondition}
                GROUP BY DATE(p.paymentDate), sr.category, p.amount
                ORDER BY date ASC, sr.category ASC
            `;

            const [rows] = await pool.execute(query, params);

            // Handle empty data case
            if (rows.length === 0) {
                return {
                    success: false,
                    filePath: null,
                    fileName: null,
                    recordCount: 0,
                    dateRange: { start: startDate, end: endDate },
                    generatedAt: new Date().toISOString(),
                    message: 'No data available for export in the selected period'
                };
            }

            // Create export directory if it doesn't exist
            const exportDir = path.join(process.cwd(), 'backend', 'exports', 'earnings');
            await fs.mkdir(exportDir, { recursive: true });

            // Generate filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `earnings_${providerID}_${timestamp}.csv`;
            const filePath = path.join(exportDir, fileName);

            // Build CSV content
            const headers = ['date', 'amount', 'category', 'serviceCount'];
            let csvContent = headers.join(',') + '\n';

            let totalAmount = 0;
            rows.forEach(row => {
                const dateStr = row.date instanceof Date 
                    ? row.date.toISOString().split('T')[0] 
                    : row.date;
                const amount = parseFloat(row.amount) || 0;
                totalAmount += amount;
                
                const rowValues = [
                    this.escapeCSVValue(dateStr),
                    this.escapeCSVValue(amount.toFixed(2)),
                    this.escapeCSVValue(row.category),
                    this.escapeCSVValue(row.serviceCount)
                ];
                csvContent += rowValues.join(',') + '\n';
            });

            // Write to file
            await fs.writeFile(filePath, csvContent, 'utf8');

            analyticsLogger.info('CSV export generated successfully', { 
                providerID, 
                filePath, 
                recordCount: rows.length 
            });

            return {
                success: true,
                filePath,
                fileName,
                recordCount: rows.length,
                totalAmount: Math.round(totalAmount * 100) / 100,
                dateRange: { start: startDate, end: endDate },
                generatedAt: new Date().toISOString()
            };
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error generating CSV export', { 
                providerID, startDate, endDate, categories, error: error.message 
            });
            throw mapDatabaseError(error);
        }
    }

    /**
     * Get earnings data for export (without writing to file)
     * Useful for testing and API responses
     * @param {number} providerID - Provider's user ID
     * @param {string} startDate - Start date in YYYY-MM-DD format
     * @param {string} endDate - End date in YYYY-MM-DD format
     * @param {string[]} categories - Optional category filter
     * @returns {Promise<object>} Earnings data and CSV content
     */
    static async getExportData(providerID, startDate, endDate, categories = []) {
        try {
            // Validate inputs
            if (!providerID || isNaN(parseInt(providerID))) {
                throw new ValidationError('Invalid provider ID format');
            }

            if (!startDate || !this.isValidDateFormat(startDate)) {
                throw new ValidationError('Start date must be in YYYY-MM-DD format');
            }

            if (!endDate || !this.isValidDateFormat(endDate)) {
                throw new ValidationError('End date must be in YYYY-MM-DD format');
            }

            if (new Date(startDate) > new Date(endDate)) {
                throw new ValidationError('Start date must be before or equal to end date');
            }

            // Build category filter condition
            let categoryCondition = '';
            const params = [providerID, startDate, endDate];
            
            if (categories && categories.length > 0) {
                const placeholders = categories.map(() => '?').join(', ');
                categoryCondition = `AND sr.category IN (${placeholders})`;
                params.push(...categories);
            }

            // Query for earnings data
            const query = `
                SELECT 
                    DATE(p.paymentDate) as date,
                    p.amount,
                    sr.category,
                    COUNT(DISTINCT sr.requestID) as serviceCount
                FROM Payment p
                JOIN ServiceRequest sr ON p.requestID = sr.requestID
                WHERE sr.providerID = ?
                    AND p.status = 'Completed'
                    AND DATE(p.paymentDate) >= ?
                    AND DATE(p.paymentDate) <= ?
                    ${categoryCondition}
                GROUP BY DATE(p.paymentDate), sr.category, p.amount
                ORDER BY date ASC, sr.category ASC
            `;

            const [rows] = await pool.execute(query, params);

            // Transform rows
            const records = rows.map(row => ({
                date: row.date instanceof Date 
                    ? row.date.toISOString().split('T')[0] 
                    : row.date,
                amount: parseFloat(row.amount) || 0,
                category: row.category,
                serviceCount: parseInt(row.serviceCount, 10) || 0
            }));

            // Calculate total
            const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);

            // Build CSV content
            const headers = ['date', 'amount', 'category', 'serviceCount'];
            let csvContent = headers.join(',') + '\n';
            
            records.forEach(record => {
                const rowValues = [
                    this.escapeCSVValue(record.date),
                    this.escapeCSVValue(record.amount.toFixed(2)),
                    this.escapeCSVValue(record.category),
                    this.escapeCSVValue(record.serviceCount)
                ];
                csvContent += rowValues.join(',') + '\n';
            });

            return {
                records,
                recordCount: records.length,
                totalAmount: Math.round(totalAmount * 100) / 100,
                csvContent,
                dateRange: { start: startDate, end: endDate }
            };
        } catch (error) {
            if (error instanceof ValidationError) throw error;
            analyticsLogger.error('Error getting export data', { 
                providerID, startDate, endDate, categories, error: error.message 
            });
            throw mapDatabaseError(error);
        }
    }
}

module.exports = EarningsExportService;
