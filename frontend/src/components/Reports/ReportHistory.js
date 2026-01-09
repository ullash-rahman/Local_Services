import { useState, useEffect, useCallback } from 'react';
import reportService from '../../services/reportService';
import { authService } from '../../services/authService';
import './Reports.css';

const ReportHistory = () => {
  // Get current user
  const user = authService.getCurrentUser();
  const providerID = user?.userID;

  // State
  const [activeTab, setActiveTab] = useState('history');
  const [reports, setReports] = useState([]);
  const [scheduledReports, setScheduledReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const reportsPerPage = 10;

  // Schedule modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    reportType: 'comprehensive',
    frequency: 'weekly',
    format: 'pdf',
    emailRecipients: []
  });
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);

  // Available report types for scheduling (must match backend REPORT_TYPES)
  const reportTypes = [
    { value: 'comprehensive', label: 'Comprehensive Report' },
    { value: 'revenue', label: 'Revenue Analytics' },
    { value: 'performance', label: 'Performance Metrics' },
    { value: 'customer', label: 'Customer Analytics' },
    { value: 'custom', label: 'Custom Report' }
  ];

  // Available frequencies
  const frequencies = reportService.getAvailableFrequencies();

  // Available formats
  const formats = reportService.getAvailableFormats();

  /**
   * Fetch report history
   */
  const fetchReportHistory = useCallback(async () => {
    if (!providerID) return;

    try {
      setLoading(true);
      setError(null);

      const response = await reportService.getReportHistory(providerID, {
        page: currentPage,
        limit: reportsPerPage
      });

      // Response structure: { success, data: { providerID, reports, pagination, ... } }
      if (response.success && response.data) {
        setReports(response.data.reports || []);
        setTotalPages(response.data.pagination?.totalPages || 1);
      } else {
        setReports([]);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Error fetching report history:', err);
      setError('Failed to load report history. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [providerID, currentPage]);

  /**
   * Fetch scheduled reports from API
   */
  const fetchScheduledReports = useCallback(async () => {
    try {
      const response = await reportService.getScheduledReports(providerID);
      if (response.success && response.data) {
        // Map the data to use consistent field names
        const reports = response.data.scheduledReports.map(report => ({
          id: report.scheduleID,
          scheduleID: report.scheduleID,
          reportType: report.reportType,
          reportName: report.reportOptions?.reportType || report.reportType,
          frequency: report.frequency,
          format: report.reportOptions?.format || 'pdf',
          nextRun: report.nextRunDate,
          emailRecipients: report.emailRecipients || []
        }));
        setScheduledReports(reports);
      }
    } catch (err) {
      console.error('Error fetching scheduled reports:', err);
      // Set empty array on error - don't show error to user for this
      setScheduledReports([]);
    }
  }, [providerID]);

  // Fetch data on mount and when page changes
  useEffect(() => {
    fetchReportHistory();
    fetchScheduledReports();
  }, [fetchReportHistory, fetchScheduledReports]);

  /**
   * Handle report download
   */
  const handleDownload = async (report) => {
    try {
      setDownloading(report.reportID);
      
      // Handle both flat and nested date formats from backend
      const startDate = report.startDate || report.dateRange?.start;
      const endDate = report.endDate || report.dateRange?.end;
      
      const filename = reportService.generateFilename(
        report.reportType || 'report',
        startDate,
        endDate,
        report.format
      );

      await reportService.downloadReportFile(report.reportID, filename);
    } catch (err) {
      console.error('Error downloading report:', err);
      setError('Failed to download report. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  /**
   * Get icon for report format
   */
  const getFormatIcon = (format) => {
    const icons = {
      'pdf': '📕',
      'csv': '📊',
      'xlsx': '📗',
      'excel': '📗'
    };
    return icons[format?.toLowerCase()] || '📄';
  };

  /**
   * Format file size
   */
  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * Handle adding email to recipients
   */
  const handleAddEmail = () => {
    if (newEmail && !scheduleForm.emailRecipients.includes(newEmail)) {
      setScheduleForm(prev => ({
        ...prev,
        emailRecipients: [...prev.emailRecipients, newEmail]
      }));
      setNewEmail('');
    }
  };

  /**
   * Handle removing email from recipients
   */
  const handleRemoveEmail = (email) => {
    setScheduleForm(prev => ({
      ...prev,
      emailRecipients: prev.emailRecipients.filter(e => e !== email)
    }));
  };

  /**
   * Handle schedule form submission
   */
  const handleScheduleSubmit = async () => {
    try {
      setSaving(true);

      await reportService.scheduleReport({
        providerID,
        ...scheduleForm
      });

      // Refresh scheduled reports
      await fetchScheduledReports();
      
      // Reset form and close modal
      setScheduleForm({
        reportType: 'comprehensive',
        frequency: 'weekly',
        format: 'pdf',
        emailRecipients: []
      });
      setShowScheduleModal(false);
    } catch (err) {
      console.error('Error scheduling report:', err);
      setError('Failed to schedule report. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle canceling a scheduled report
   */
  const handleCancelSchedule = async (scheduleID) => {
    try {
      await reportService.cancelScheduledReport(scheduleID);
      setScheduledReports(prev => prev.filter(s => s.scheduleID !== scheduleID));
    } catch (err) {
      console.error('Error canceling schedule:', err);
      setError('Failed to cancel scheduled report. Please try again.');
    }
  };

  if (loading && reports.length === 0) {
    return (
      <div className="report-history">
        <div className="report-loading">
          <div className="loading-spinner"></div>
          <p>Loading report history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="report-history">
      <div className="report-history-header">
        <div>
          <h2>Report History</h2>
          <p className="header-description">
            View and download your previously generated reports
          </p>
        </div>
        <div className="history-controls">
          <button 
            className="schedule-button"
            onClick={() => setShowScheduleModal(true)}
          >
            <span>📅</span>
            Schedule Report
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="report-message error">
          <span className="message-icon">⚠️</span>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="history-tabs">
        <button
          className={`history-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Report History
        </button>
        <button
          className={`history-tab ${activeTab === 'scheduled' ? 'active' : ''}`}
          onClick={() => setActiveTab('scheduled')}
        >
          Scheduled Reports
        </button>
      </div>

      {/* Report History Tab */}
      {activeTab === 'history' && (
        <>
          {reports.length === 0 ? (
            <div className="empty-history">
              <span className="empty-icon">📋</span>
              <h3>No Reports Yet</h3>
              <p>Generate your first report to see it here</p>
            </div>
          ) : (
            <>
              <div className="report-list">
                {reports.map(report => (
                  <div key={report.reportID} className="report-item">
                    <div className="report-info">
                      <span className="report-icon">
                        {getFormatIcon(report.format)}
                      </span>
                      <div className="report-details">
                        <h4 className="report-name">
                          {report.reportName || report.reportType || 'Custom Report'}
                        </h4>
                        <div className="report-meta">
                          <span className="report-date">
                            📅 {formatDate(report.createdAt)}
                          </span>
                          <span className="report-format">
                            {reportService.getFormatLabel(report.format)}
                          </span>
                          <span className="report-size">
                            {formatFileSize(report.fileSize)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="report-actions">
                      <button
                        className="download-button"
                        onClick={() => handleDownload(report)}
                        disabled={downloading === report.reportID}
                      >
                        {downloading === report.reportID ? 'Downloading...' : '⬇️ Download'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    className="pagination-button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  <span className="pagination-info">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    className="pagination-button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Scheduled Reports Tab */}
      {activeTab === 'scheduled' && (
        <>
          {scheduledReports.length === 0 ? (
            <div className="empty-history">
              <span className="empty-icon">📅</span>
              <h3>No Scheduled Reports</h3>
              <p>Set up automated report generation to receive reports regularly</p>
            </div>
          ) : (
            <div className="scheduled-list">
              {scheduledReports.map(schedule => (
                <div key={schedule.id} className="scheduled-item">
                  <div className="scheduled-info">
                    <span className="scheduled-icon">🔄</span>
                    <div className="scheduled-details">
                      <h4 className="scheduled-name">{schedule.reportName}</h4>
                      <div className="scheduled-meta">
                        <span className="frequency-badge">
                          {reportService.getFrequencyLabel(schedule.frequency)}
                        </span>
                        <span className="next-run">
                          Next: {formatDate(schedule.nextRun)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="scheduled-actions">
                    <button
                      className="cancel-schedule-button"
                      onClick={() => handleCancelSchedule(schedule.scheduleID)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="schedule-modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="schedule-modal" onClick={(e) => e.stopPropagation()}>
            <div className="schedule-modal-header">
              <h3>Schedule Automated Report</h3>
              <button className="close-modal" onClick={() => setShowScheduleModal(false)}>
                ×
              </button>
            </div>
            
            <div className="schedule-form">
              <div className="schedule-form-group">
                <label>Report Type</label>
                <select
                  value={scheduleForm.reportType}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, reportType: e.target.value }))}
                >
                  {reportTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="schedule-form-group">
                <label>Frequency</label>
                <select
                  value={scheduleForm.frequency}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, frequency: e.target.value }))}
                >
                  {frequencies.map(freq => (
                    <option key={freq.value} value={freq.value}>
                      {freq.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="schedule-form-group">
                <label>Format</label>
                <select
                  value={scheduleForm.format}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, format: e.target.value }))}
                >
                  {formats.map(fmt => (
                    <option key={fmt.value} value={fmt.value}>
                      {fmt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="schedule-form-group">
                <label>Email Recipients</label>
                <div className="email-input-group">
                  <input
                    type="email"
                    placeholder="Enter email address"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddEmail()}
                  />
                  <button 
                    className="add-email-button"
                    onClick={handleAddEmail}
                    type="button"
                  >
                    Add
                  </button>
                </div>
                {scheduleForm.emailRecipients.length > 0 && (
                  <div className="email-list">
                    {scheduleForm.emailRecipients.map(email => (
                      <span key={email} className="email-tag">
                        {email}
                        <button 
                          className="remove-email"
                          onClick={() => handleRemoveEmail(email)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="schedule-modal-actions">
              <button 
                className="cancel-modal-button"
                onClick={() => setShowScheduleModal(false)}
              >
                Cancel
              </button>
              <button
                className="save-schedule-button"
                onClick={handleScheduleSubmit}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Schedule Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportHistory;
