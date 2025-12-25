const ReportGenerator = require('../services/ReportGenerator');
const fs = require('fs').promises;
const path = require('path');

const validateProviderAccess = (req, providerID) => {
    const parsedProviderID = parseInt(providerID, 10);
    
    if (isNaN(parsedProviderID) || parsedProviderID <= 0) {
        return { valid: false, error: 'Invalid provider ID', statusCode: 400 };
    }

    const requestingUserID = req.user?.userID;
    const isOwnReports = requestingUserID === parsedProviderID;
    const isAdmin = req.user?.role === 'Admin';

    if (!isOwnReports && !isAdmin) {
        return { valid: false, error: 'You can only access your own reports', statusCode: 403 };
    }

    return { valid: true, providerID: parsedProviderID };
};

const generateReport = async (req, res) => {
    try {
        const { providerID, reportType, format, dateRangeStart, dateRangeEnd, sections } = req.body;
        
        const validation = validateProviderAccess(req, providerID);
        if (!validation.valid) {
            return res.status(validation.statusCode).json({
                success: false,
                message: validation.error
            });
        }

        console.log('Generating report', { 
            providerID: validation.providerID, 
            reportType, 
            format 
        });

        // Generate and export the report
        const exportResult = await ReportGenerator.exportData(
            validation.providerID,
            format || 'pdf',
            {
                reportType: reportType || 'comprehensive',
                dateRangeStart,
                dateRangeEnd,
                sections
            }
        );

        res.status(201).json({
            success: true,
            message: 'Report generated successfully',
            data: {
                reportID: exportResult.reportID,
                providerID: validation.providerID,
                filename: exportResult.filename,
                format: exportResult.format,
                size: exportResult.size,
                generatedAt: exportResult.generatedAt,
                expiresAt: exportResult.expiresAt,
                downloadUrl: `/api/reports/download/${exportResult.reportID}`
            }
        });
    } catch (error) {
        console.error('Generate report error:', { error: error.message });
        
        if (error.statusCode === 400) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error while generating report',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};


const getTemplates = async (req, res) => {
    try {
        console.log('Getting report templates');

        const templates = await ReportGenerator.getTemplates();

        res.status(200).json({
            success: true,
            data: templates
        });
    } catch (error) {
        console.error('Get templates error:', { error: error.message });

        res.status(500).json({
            success: false,
            message: 'Server error while fetching report templates',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

const getReportHistory = async (req, res) => {
    try {
        const { providerID } = req.params;
        
        const validation = validateProviderAccess(req, providerID);
        if (!validation.valid) {
            return res.status(validation.statusCode).json({
                success: false,
                message: validation.error
            });
        }

        const { limit, offset, reportType, format, startDate, endDate } = req.query;

        console.log('Getting report history', { 
            providerID: validation.providerID,
            limit,
            offset
        });

        const history = await ReportGenerator.getReportHistory(validation.providerID, {
            limit: limit ? parseInt(limit, 10) : 50,
            offset: offset ? parseInt(offset, 10) : 0,
            reportType,
            format,
            startDate,
            endDate
        });

        res.status(200).json({
            success: true,
            data: {
                providerID: validation.providerID,
                ...history
            }
        });
    } catch (error) {
        console.error('Get report history error:', { error: error.message });
        
        if (error.statusCode === 400) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error while fetching report history',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

const downloadReport = async (req, res) => {
    try {
        const { reportID } = req.params;
        const parsedReportID = parseInt(reportID, 10);

        if (isNaN(parsedReportID) || parsedReportID <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid report ID'
            });
        }

        console.log('Downloading report', { reportID: parsedReportID });

        // Get report details from database
        const pool = require('../config/database');
        const [rows] = await pool.execute(
            `SELECT reportID, providerID, reportType, filePath, fileFormat, generatedAt, expiresAt
             FROM GeneratedReport 
             WHERE reportID = ?`,
            [parsedReportID]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }

        const report = rows[0];

        // Validate provider access
        const validation = validateProviderAccess(req, report.providerID);
        if (!validation.valid) {
            return res.status(validation.statusCode).json({
                success: false,
                message: validation.error
            });
        }

        // Check if report has expired
        if (report.expiresAt && new Date(report.expiresAt) < new Date()) {
            return res.status(410).json({
                success: false,
                message: 'Report has expired and is no longer available'
            });
        }

        // Check if file exists
        if (!report.filePath) {
            return res.status(404).json({
                success: false,
                message: 'Report file not found'
            });
        }

        try {
            await fs.access(report.filePath);
        } catch {
            return res.status(404).json({
                success: false,
                message: 'Report file not found on server'
            });
        }

        // Set appropriate content type
        const contentTypes = {
            'pdf': 'application/pdf',
            'csv': 'text/csv',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };

        const contentType = contentTypes[report.fileFormat] || 'application/octet-stream';
        const filename = path.basename(report.filePath);

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Stream the file
        const fileContent = await fs.readFile(report.filePath);
        res.send(fileContent);
    } catch (error) {
        console.error('Download report error:', { error: error.message });

        res.status(500).json({
            success: false,
            message: 'Server error while downloading report',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};


const scheduleReport = async (req, res) => {
    try {
        const { 
            providerID, 
            frequency, 
            emailRecipients, 
            startDate,
            reportType,
            format,
            sections
        } = req.body;
        
        const validation = validateProviderAccess(req, providerID);
        if (!validation.valid) {
            return res.status(validation.statusCode).json({
                success: false,
                message: validation.error
            });
        }

        console.log('Scheduling report', { 
            providerID: validation.providerID, 
            frequency 
        });

        const schedule = {
            frequency,
            emailRecipients,
            startDate,
            isActive: true
        };

        const options = {
            reportType: reportType || 'comprehensive',
            format: format || 'pdf',
            sections
        };

        const scheduledReport = await ReportGenerator.scheduleReport(
            validation.providerID,
            schedule,
            options
        );

        res.status(201).json({
            success: true,
            message: 'Report scheduled successfully',
            data: scheduledReport
        });
    } catch (error) {
        console.error('Schedule report error:', { error: error.message });
        
        if (error.statusCode === 400) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error while scheduling report',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

const cancelScheduledReport = async (req, res) => {
    try {
        const { scheduleID } = req.params;
        const parsedScheduleID = parseInt(scheduleID, 10);

        if (isNaN(parsedScheduleID) || parsedScheduleID <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid schedule ID'
            });
        }

        // Get the schedule to verify ownership
        const pool = require('../config/database');
        const [rows] = await pool.execute(
            `SELECT scheduleID, providerID FROM ScheduledReport WHERE scheduleID = ?`,
            [parsedScheduleID]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Scheduled report not found'
            });
        }

        const schedule = rows[0];

        // Validate provider access
        const validation = validateProviderAccess(req, schedule.providerID);
        if (!validation.valid) {
            return res.status(validation.statusCode).json({
                success: false,
                message: validation.error
            });
        }

        console.log('Cancelling scheduled report', { 
            scheduleID: parsedScheduleID,
            providerID: validation.providerID
        });

        const result = await ReportGenerator.cancelScheduledReport(
            parsedScheduleID,
            validation.providerID
        );

        res.status(200).json({
            success: true,
            message: 'Scheduled report cancelled successfully',
            data: result
        });
    } catch (error) {
        console.error('Cancel scheduled report error:', { error: error.message });
        
        if (error.statusCode === 400) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error while cancelling scheduled report',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

module.exports = {
    generateReport,
    getTemplates,
    getReportHistory,
    downloadReport,
    scheduleReport,
    cancelScheduledReport
};