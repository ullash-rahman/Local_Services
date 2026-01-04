import React, { useState, useEffect, useCallback } from 'react';
import { authService } from '../../services/authService';
import earningsService from '../../services/earningsService';
import './Earnings.css';

/**
 * ExportPanel - Component for exporting earnings data
 * Provides date range selector, category filter, and export functionality
 * with download handling and status/error display.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
const ExportPanel = ({ onExportComplete }) => {
    // Get current user
    const user = authService.getCurrentUser();
    const providerID = user?.userID;

    // Date range state
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Category filter state
    const [availableCategories, setAvailableCategories] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);

    // Export state
    const [isExporting, setIsExporting] = useState(false);
    const [exportStatus, setExportStatus] = useState(null); // 'success' | 'error' | 'no-data' | null
    const [exportMessage, setExportMessage] = useState('');

    // UI state
    const [isLoadingCategories, setIsLoadingCategories] = useState(true);

    /**
     * Initialize default date range (last 30 days)
     */
    useEffect(() => {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);

        setEndDate(earningsService.toDateString(today));
        setStartDate(earningsService.toDateString(thirtyDaysAgo));
    }, []);

    /**
     * Fetch available categories for the provider
     */
    const fetchCategories = useCallback(async () => {
        if (!providerID) return;

        setIsLoadingCategories(true);
        try {
            const categories = await earningsService.getProviderCategories(providerID);
            setAvailableCategories(categories || []);
        } catch (err) {
            console.error('Error fetching categories:', err);
        } finally {
            setIsLoadingCategories(false);
        }
    }, [providerID]);

    // Fetch categories on mount
    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    /**
     * Handle start date change
     */
    const handleStartDateChange = (e) => {
        setStartDate(e.target.value);
        // Clear any previous status
        setExportStatus(null);
        setExportMessage('');
    };

    /**
     * Handle end date change
     */
    const handleEndDateChange = (e) => {
        setEndDate(e.target.value);
        // Clear any previous status
        setExportStatus(null);
        setExportMessage('');
    };

    /**
     * Handle category selection toggle
     */
    const handleCategoryToggle = (category) => {
        setSelectedCategories(prev => {
            if (prev.includes(category)) {
                return prev.filter(c => c !== category);
            }
            return [...prev, category];
        });
        // Clear any previous status
        setExportStatus(null);
        setExportMessage('');
    };

    /**
     * Clear all selected categories
     */
    const clearCategoryFilter = () => {
        setSelectedCategories([]);
        setExportStatus(null);
        setExportMessage('');
    };

    /**
     * Select all categories
     */
    const selectAllCategories = () => {
        setSelectedCategories([...availableCategories]);
        setExportStatus(null);
        setExportMessage('');
    };

    /**
     * Validate date range
     */
    const validateDateRange = () => {
        if (!startDate || !endDate) {
            return { valid: false, message: 'Please select both start and end dates' };
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        if (start > end) {
            return { valid: false, message: 'Start date must be before end date' };
        }

        if (end > today) {
            return { valid: false, message: 'End date cannot be in the future' };
        }

        return { valid: true, message: '' };
    };

    /**
     * Handle export button click
     */
    const handleExport = async () => {
        // Validate date range
        const validation = validateDateRange();
        if (!validation.valid) {
            setExportStatus('error');
            setExportMessage(validation.message);
            return;
        }

        if (!providerID) {
            setExportStatus('error');
            setExportMessage('User not authenticated');
            return;
        }

        setIsExporting(true);
        setExportStatus(null);
        setExportMessage('');

        try {
            const blob = await earningsService.exportEarnings(
                providerID,
                startDate,
                endDate,
                selectedCategories
            );

            // Check if the response is empty or indicates no data
            if (!blob || blob.size === 0) {
                setExportStatus('no-data');
                setExportMessage('No earnings data available for the selected period and filters.');
                return;
            }

            // Check if the response is an error message (JSON)
            if (blob.type === 'application/json') {
                const text = await blob.text();
                const errorData = JSON.parse(text);
                if (errorData.message) {
                    setExportStatus('no-data');
                    setExportMessage(errorData.message);
                    return;
                }
            }

            // Generate filename and trigger download
            const filename = earningsService.generateExportFilename(startDate, endDate);
            earningsService.downloadBlob(blob, filename);

            setExportStatus('success');
            setExportMessage(`Export completed! File: ${filename}`);

            // Notify parent component if callback provided
            if (onExportComplete) {
                onExportComplete({ success: true, filename });
            }

            // Clear success message after 5 seconds
            setTimeout(() => {
                setExportStatus(null);
                setExportMessage('');
            }, 5000);

        } catch (err) {
            console.error('Error exporting earnings:', err);
            
            // Handle specific error cases
            if (err.response?.status === 404) {
                setExportStatus('no-data');
                setExportMessage('No earnings data available for the selected period and filters.');
            } else {
                setExportStatus('error');
                setExportMessage(
                    err.response?.data?.message || 
                    'Failed to export earnings data. Please try again.'
                );
            }
        } finally {
            setIsExporting(false);
        }
    };

    /**
     * Get formatted date range display
     */
    const getDateRangeDisplay = () => {
        if (!startDate || !endDate) return '';
        return `${earningsService.formatDate(startDate)} - ${earningsService.formatDate(endDate)}`;
    };

    /**
     * Check if export button should be disabled
     */
    const isExportDisabled = () => {
        return isExporting || !startDate || !endDate;
    };

    return (
        <div className="export-panel">
            <div className="export-panel-header">
                <h2>Export Earnings Data</h2>
                <p className="export-panel-subtitle">
                    Download your earnings data as a CSV file for accounting and tax purposes
                </p>
            </div>

            {/* Status Messages */}
            {exportStatus === 'success' && (
                <div className="export-message success">
                    <span className="message-icon">✓</span>
                    {exportMessage}
                </div>
            )}

            {exportStatus === 'error' && (
                <div className="export-message error">
                    <span className="message-icon">⚠️</span>
                    {exportMessage}
                </div>
            )}

            {exportStatus === 'no-data' && (
                <div className="export-message warning">
                    <span className="message-icon">ℹ️</span>
                    {exportMessage}
                </div>
            )}

            {/* Date Range Section */}
            <div className="export-section">
                <h3>Select Date Range</h3>
                <div className="date-range-selector">
                    <div className="date-field">
                        <label htmlFor="export-start-date">Start Date</label>
                        <input
                            type="date"
                            id="export-start-date"
                            value={startDate}
                            onChange={handleStartDateChange}
                            max={earningsService.getTodayString()}
                            className="date-input"
                        />
                    </div>
                    <span className="date-separator">to</span>
                    <div className="date-field">
                        <label htmlFor="export-end-date">End Date</label>
                        <input
                            type="date"
                            id="export-end-date"
                            value={endDate}
                            onChange={handleEndDateChange}
                            max={earningsService.getTodayString()}
                            className="date-input"
                        />
                    </div>
                </div>
                {startDate && endDate && (
                    <p className="date-range-display">
                        Selected period: {getDateRangeDisplay()}
                    </p>
                )}
            </div>

            {/* Category Filter Section */}
            <div className="export-section">
                <div className="section-header">
                    <h3>Filter by Category (Optional)</h3>
                    {availableCategories.length > 0 && (
                        <div className="category-actions">
                            <button 
                                type="button"
                                className="link-button"
                                onClick={selectAllCategories}
                            >
                                Select All
                            </button>
                            {selectedCategories.length > 0 && (
                                <button 
                                    type="button"
                                    className="link-button"
                                    onClick={clearCategoryFilter}
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {isLoadingCategories ? (
                    <div className="categories-loading">
                        <span className="loading-text">Loading categories...</span>
                    </div>
                ) : availableCategories.length === 0 ? (
                    <p className="no-categories-message">
                        No categories available. All earnings will be exported.
                    </p>
                ) : (
                    <>
                        <div className="export-category-chips">
                            {availableCategories.map(category => (
                                <button
                                    key={category}
                                    type="button"
                                    className={`category-chip ${selectedCategories.includes(category) ? 'active' : ''}`}
                                    onClick={() => handleCategoryToggle(category)}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>
                        <p className="category-hint">
                            {selectedCategories.length === 0 
                                ? 'No filter applied - all categories will be exported'
                                : `${selectedCategories.length} categor${selectedCategories.length === 1 ? 'y' : 'ies'} selected`
                            }
                        </p>
                    </>
                )}
            </div>

            {/* Export Info Section */}
            <div className="export-info">
                <h4>Export Details</h4>
                <ul className="export-info-list">
                    <li>
                        <span className="info-icon">📄</span>
                        Format: CSV (Comma-Separated Values)
                    </li>
                    <li>
                        <span className="info-icon">📊</span>
                        Includes: Date, Amount, Service Category, Service Count
                    </li>
                    <li>
                        <span className="info-icon">💾</span>
                        Compatible with Excel, Google Sheets, and accounting software
                    </li>
                </ul>
            </div>

            {/* Export Button */}
            <div className="export-actions">
                <button
                    type="button"
                    className="export-button"
                    onClick={handleExport}
                    disabled={isExportDisabled()}
                >
                    {isExporting ? (
                        <>
                            <span className="export-spinner"></span>
                            Generating Export...
                        </>
                    ) : (
                        <>
                            <span className="export-icon">📥</span>
                            Export to CSV
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default ExportPanel;
