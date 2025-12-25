import { useState, useEffect } from 'react';
import reportService from '../../services/reportService';
import { authService } from '../../services/authService';
import './Reports.css';

const ReportGenerator = ({ onReportGenerated }) => {
  // Get current user
  const user = authService.getCurrentUser();
  const providerID = user?.userID;

  // Form state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [format, setFormat] = useState('pdf');
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  // UI state
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [validationError, setValidationError] = useState(null);

  // Available metrics for selection
  const availableMetrics = [
    { id: 'revenue', label: 'Revenue & Earnings', description: 'Total earnings, trends, and breakdowns' },
    { id: 'performance', label: 'Performance Metrics', description: 'Completion rate, response time, cancellations' },
    { id: 'customers', label: 'Customer Analytics', description: 'Customer count, retention, acquisition' },
    { id: 'ratings', label: 'Ratings & Reviews', description: 'Average ratings, review counts, satisfaction' },
    { id: 'services', label: 'Service Statistics', description: 'Service volume, popular services, trends' }
  ];

  // Available categories (would typically come from API)
  const availableCategories = [
    { id: 'all', label: 'All Categories' },
    { id: 'plumbing', label: 'Plumbing' },
    { id: 'electrical', label: 'Electrical' },
    { id: 'cleaning', label: 'Cleaning' },
    { id: 'landscaping', label: 'Landscaping' },
    { id: 'handyman', label: 'Handyman' },
    { id: 'hvac', label: 'HVAC' }
  ];

  // Available formats
  const availableFormats = reportService.getAvailableFormats();

  // Set default dates (last 30 days)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  // Fetch templates on mount
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        const response = await reportService.getTemplates();
        setTemplates(response.templates || []);
      } catch (err) {
        console.error('Error fetching templates:', err);
        // Use default templates if API fails
        setTemplates([
          { id: 'monthly-summary', name: 'Monthly Summary', description: 'Overview of monthly performance' },
          { id: 'tax-report', name: 'Tax Report', description: 'Earnings report for tax purposes' },
          { id: 'performance-review', name: 'Performance Review', description: 'Detailed performance analysis' },
          { id: 'client-presentation', name: 'Client Presentation', description: 'Professional summary for clients' }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);


  /**
   * Handle metric selection toggle
   */
  const handleMetricToggle = (metricId) => {
    setSelectedMetrics(prev => {
      if (prev.includes(metricId)) {
        return prev.filter(id => id !== metricId);
      }
      return [...prev, metricId];
    });
    setValidationError(null);
  };

  /**
   * Handle category selection toggle
   */
  const handleCategoryToggle = (categoryId) => {
    if (categoryId === 'all') {
      setSelectedCategories(['all']);
    } else {
      setSelectedCategories(prev => {
        const filtered = prev.filter(id => id !== 'all');
        if (filtered.includes(categoryId)) {
          return filtered.filter(id => id !== categoryId);
        }
        return [...filtered, categoryId];
      });
    }
    setValidationError(null);
  };

  /**
   * Handle template selection
   */
  const handleTemplateSelect = (templateId) => {
    setSelectedTemplate(templateId);
    
    // Pre-fill metrics based on template
    if (templateId === 'monthly-summary') {
      setSelectedMetrics(['revenue', 'performance', 'customers']);
    } else if (templateId === 'tax-report') {
      setSelectedMetrics(['revenue']);
    } else if (templateId === 'performance-review') {
      setSelectedMetrics(['performance', 'ratings', 'services']);
    } else if (templateId === 'client-presentation') {
      setSelectedMetrics(['revenue', 'performance', 'ratings']);
    }
    setValidationError(null);
  };

  /**
   * Validate form before submission
   */
  const validateForm = () => {
    const dateValidation = reportService.validateDateRange(startDate, endDate);
    if (!dateValidation.isValid) {
      setValidationError(dateValidation.error);
      return false;
    }

    if (selectedMetrics.length === 0) {
      setValidationError('Please select at least one metric to include in the report');
      return false;
    }

    return true;
  };

  /**
   * Handle report preview
   */
  const handlePreview = () => {
    if (!validateForm()) return;
    setShowPreview(true);
  };

  /**
   * Handle report generation
   */
  const handleGenerate = async () => {
    if (!validateForm()) return;

    setGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const options = {
        providerID,
        startDate,
        endDate,
        format,
        metrics: selectedMetrics,
        categories: selectedCategories.length > 0 ? selectedCategories : ['all'],
        templateID: selectedTemplate || undefined
      };

      const response = await reportService.generateReport(options);
      
      setShowPreview(false);

      // Trigger download if URL is provided - show success only after download completes
      if (response.downloadUrl || response.reportID) {
        const filename = reportService.generateFilename(
          selectedTemplate || 'custom-report',
          startDate,
          endDate,
          format
        );
        
        if (response.reportID) {
          try {
            await reportService.downloadReportFile(response.reportID, filename);
            setSuccess('Report generated and downloaded successfully!');
          } catch (downloadError) {
            console.error('Download failed:', downloadError);
            setError('Report was generated but download failed. You can retry from Report History.');
            // Still notify parent so report appears in history
            if (onReportGenerated) {
              onReportGenerated(response);
            }
            return;
          }
        } else {
          setSuccess('Report generated successfully!');
        }
      } else {
        setSuccess('Report generated successfully!');
      }

      // Notify parent component
      if (onReportGenerated) {
        onReportGenerated(response);
      }
    } catch (err) {
      console.error('Error generating report:', err);
      setError(err.response?.data?.message || 'Failed to generate report. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  /**
   * Get period label for preview
   */
  const getPeriodLabel = () => {
    if (!startDate || !endDate) return '';
    const start = new Date(startDate).toLocaleDateString();
    const end = new Date(endDate).toLocaleDateString();
    return `${start} - ${end}`;
  };

  /**
   * Get selected metrics labels for preview
   */
  const getSelectedMetricsLabels = () => {
    return selectedMetrics.map(id => {
      const metric = availableMetrics.find(m => m.id === id);
      return metric?.label || id;
    });
  };

  if (loading) {
    return (
      <div className="report-generator">
        <div className="report-loading">
          <div className="loading-spinner"></div>
          <p>Loading report options...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="report-generator">
      <div className="report-generator-header">
        <h2>Generate Custom Report</h2>
        <p className="header-description">
          Create customized reports with your selected metrics and date range
        </p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="report-message error">
          <span className="message-icon">⚠️</span>
          {error}
        </div>
      )}
      {success && (
        <div className="report-message success">
          <span className="message-icon">✓</span>
          {success}
        </div>
      )}
      {validationError && (
        <div className="report-message warning">
          <span className="message-icon">!</span>
          {validationError}
        </div>
      )}

      <div className="report-form">
        {/* Template Selection */}
        <div className="form-section">
          <h3 className="section-label">Report Template (Optional)</h3>
          <p className="section-description">Choose a template or customize your own report</p>
          <div className="template-grid">
            {templates.map(template => (
              <div
                key={template.id}
                className={`template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
                onClick={() => handleTemplateSelect(template.id)}
              >
                <div className="template-icon">📄</div>
                <div className="template-info">
                  <span className="template-name">{template.name}</span>
                  <span className="template-description">{template.description}</span>
                </div>
                {selectedTemplate === template.id && (
                  <span className="template-check">✓</span>
                )}
              </div>
            ))}
          </div>
          {selectedTemplate && (
            <button 
              className="clear-template-btn"
              onClick={() => setSelectedTemplate('')}
            >
              Clear template selection
            </button>
          )}
        </div>

        {/* Date Range Picker */}
        <div className="form-section">
          <h3 className="section-label">Date Range</h3>
          <p className="section-description">Select the time period for your report</p>
          <div className="date-range-picker">
            <div className="date-input-group">
              <label htmlFor="start-date">Start Date</label>
              <input
                type="date"
                id="start-date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setValidationError(null);
                }}
                max={endDate || undefined}
              />
            </div>
            <span className="date-separator">to</span>
            <div className="date-input-group">
              <label htmlFor="end-date">End Date</label>
              <input
                type="date"
                id="end-date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setValidationError(null);
                }}
                min={startDate || undefined}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
          {/* Quick date range buttons */}
          <div className="quick-date-buttons">
            <button onClick={() => {
              const today = new Date();
              const weekAgo = new Date(today);
              weekAgo.setDate(weekAgo.getDate() - 7);
              setStartDate(weekAgo.toISOString().split('T')[0]);
              setEndDate(today.toISOString().split('T')[0]);
            }}>Last 7 Days</button>
            <button onClick={() => {
              const today = new Date();
              const monthAgo = new Date(today);
              monthAgo.setDate(monthAgo.getDate() - 30);
              setStartDate(monthAgo.toISOString().split('T')[0]);
              setEndDate(today.toISOString().split('T')[0]);
            }}>Last 30 Days</button>
            <button onClick={() => {
              const today = new Date();
              const threeMonthsAgo = new Date(today);
              threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
              setStartDate(threeMonthsAgo.toISOString().split('T')[0]);
              setEndDate(today.toISOString().split('T')[0]);
            }}>Last 3 Months</button>
            <button onClick={() => {
              const today = new Date();
              const yearAgo = new Date(today);
              yearAgo.setFullYear(yearAgo.getFullYear() - 1);
              setStartDate(yearAgo.toISOString().split('T')[0]);
              setEndDate(today.toISOString().split('T')[0]);
            }}>Last Year</button>
          </div>
        </div>


        {/* Metrics Selection */}
        <div className="form-section">
          <h3 className="section-label">Metrics to Include</h3>
          <p className="section-description">Select the data you want in your report</p>
          <div className="metrics-grid">
            {availableMetrics.map(metric => (
              <div
                key={metric.id}
                className={`metric-option ${selectedMetrics.includes(metric.id) ? 'selected' : ''}`}
                onClick={() => handleMetricToggle(metric.id)}
              >
                <div className="metric-checkbox">
                  {selectedMetrics.includes(metric.id) ? '✓' : ''}
                </div>
                <div className="metric-details">
                  <span className="metric-name">{metric.label}</span>
                  <span className="metric-desc">{metric.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Selection */}
        <div className="form-section">
          <h3 className="section-label">Service Categories</h3>
          <p className="section-description">Filter by specific service categories</p>
          <div className="categories-grid">
            {availableCategories.map(category => (
              <div
                key={category.id}
                className={`category-option ${
                  selectedCategories.includes(category.id) || 
                  (selectedCategories.length === 0 && category.id === 'all') 
                    ? 'selected' 
                    : ''
                }`}
                onClick={() => handleCategoryToggle(category.id)}
              >
                <span className="category-checkbox">
                  {selectedCategories.includes(category.id) || 
                   (selectedCategories.length === 0 && category.id === 'all') 
                    ? '✓' 
                    : ''}
                </span>
                <span className="category-name">{category.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Format Selection */}
        <div className="form-section">
          <h3 className="section-label">Export Format</h3>
          <p className="section-description">Choose the file format for your report</p>
          <div className="format-options">
            {availableFormats.map(fmt => (
              <div
                key={fmt.value}
                className={`format-option ${format === fmt.value ? 'selected' : ''}`}
                onClick={() => setFormat(fmt.value)}
              >
                <div className="format-icon">
                  {fmt.value === 'pdf' && '📕'}
                  {fmt.value === 'csv' && '📊'}
                  {fmt.value === 'xlsx' && '📗'}
                </div>
                <span className="format-label">{fmt.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="form-actions">
          <button
            className="preview-button"
            onClick={handlePreview}
            disabled={generating}
          >
            Preview Report
          </button>
          <button
            className="generate-button"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <>
                <span className="button-spinner"></span>
                Generating...
              </>
            ) : (
              'Generate & Download'
            )}
          </button>
        </div>
      </div>

      {/* Report Preview Modal */}
      {showPreview && (
        <div className="preview-modal-overlay" onClick={() => setShowPreview(false)}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="preview-header">
              <h3>Report Preview</h3>
              <button className="close-preview" onClick={() => setShowPreview(false)}>×</button>
            </div>
            <div className="preview-content">
              <div className="preview-section">
                <span className="preview-label">Report Type:</span>
                <span className="preview-value">
                  {selectedTemplate 
                    ? templates.find(t => t.id === selectedTemplate)?.name 
                    : 'Custom Report'}
                </span>
              </div>
              <div className="preview-section">
                <span className="preview-label">Date Range:</span>
                <span className="preview-value">{getPeriodLabel()}</span>
              </div>
              <div className="preview-section">
                <span className="preview-label">Format:</span>
                <span className="preview-value">{reportService.getFormatLabel(format)}</span>
              </div>
              <div className="preview-section">
                <span className="preview-label">Included Metrics:</span>
                <div className="preview-metrics">
                  {getSelectedMetricsLabels().map((label, idx) => (
                    <span key={idx} className="preview-metric-tag">{label}</span>
                  ))}
                </div>
              </div>
              <div className="preview-section">
                <span className="preview-label">Categories:</span>
                <span className="preview-value">
                  {selectedCategories.length === 0 || selectedCategories.includes('all')
                    ? 'All Categories'
                    : selectedCategories.map(id => 
                        availableCategories.find(c => c.id === id)?.label
                      ).join(', ')}
                </span>
              </div>
            </div>
            <div className="preview-actions">
              <button className="cancel-button" onClick={() => setShowPreview(false)}>
                Cancel
              </button>
              <button 
                className="confirm-generate-button" 
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? 'Generating...' : 'Generate Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportGenerator;
