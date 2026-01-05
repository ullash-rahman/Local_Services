import React, { useState, useEffect, useCallback } from 'react';
import { paymentService } from '../../services/paymentService';
import './Payment.css';

/**
 * PaymentSummary - Displays payment summary statistics
 * Shows summary cards for each status (Pending, Paid, Overdue)
 * Displays total outstanding and collection rate
 * 
 * Requirements: 4.1, 4.2, 4.3
 */
const PaymentSummary = ({ 
    providerId,
    dateRange = {},
    refreshTrigger,
    onSummaryLoaded
}) => {
    const [summary, setSummary] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    /**
     * Fetch payment summary from API
     */
    const fetchSummary = useCallback(async () => {
        if (!providerId) return;
        
        setIsLoading(true);
        setError(null);

        try {
            const data = await paymentService.getPaymentSummary(providerId, dateRange);
            setSummary(data);
            if (onSummaryLoaded) {
                onSummaryLoaded(data);
            }
        } catch (err) {
            console.error('Error fetching payment summary:', err);
            setError('Failed to load payment summary');
        } finally {
            setIsLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [providerId, dateRange?.startDate, dateRange?.endDate, onSummaryLoaded]);

    // Fetch summary on mount and when dependencies change
    useEffect(() => {
        fetchSummary();
    }, [fetchSummary, refreshTrigger]);

    // Loading state
    if (isLoading) {
        return (
            <div className="payment-summary-loading">
                <div className="loading-spinner"></div>
                <p>Loading summary...</p>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="payment-summary-error">
                <div className="error-icon">⚠️</div>
                <p>{error}</p>
                <button className="retry-button" onClick={fetchSummary}>
                    Try Again
                </button>
            </div>
        );
    }

    // No data state
    if (!summary) {
        return (
            <div className="payment-summary-empty">
                <p>No payment data available</p>
            </div>
        );
    }

    return (
        <div className="payment-summary">
            {/* Status Cards */}
            <div className="summary-cards">
                {/* Pending Card */}
                <div className="summary-card pending">
                    <div className="card-icon">⏳</div>
                    <div className="card-content">
                        <span className="card-label">Pending</span>
                        <span className="card-count">{summary.pending?.count || 0}</span>
                        <span className="card-amount">
                            {paymentService.formatCurrency(summary.pending?.amount || 0)}
                        </span>
                    </div>
                </div>

                {/* Paid Card */}
                <div className="summary-card paid">
                    <div className="card-icon">✅</div>
                    <div className="card-content">
                        <span className="card-label">Paid</span>
                        <span className="card-count">{summary.paid?.count || 0}</span>
                        <span className="card-amount">
                            {paymentService.formatCurrency(summary.paid?.amount || 0)}
                        </span>
                    </div>
                </div>

                {/* Overdue Card */}
                <div className="summary-card overdue">
                    <div className="card-icon">⚠️</div>
                    <div className="card-content">
                        <span className="card-label">Overdue</span>
                        <span className="card-count">{summary.overdue?.count || 0}</span>
                        <span className="card-amount">
                            {paymentService.formatCurrency(summary.overdue?.amount || 0)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Totals Section */}
            <div className="summary-totals">
                {/* Total Outstanding */}
                <div className="total-card outstanding">
                    <div className="total-label">Total Outstanding</div>
                    <div className="total-value">
                        {paymentService.formatCurrency(summary.totalOutstanding || 0)}
                    </div>
                    <div className="total-subtitle">
                        Pending + Overdue payments
                    </div>
                </div>

                {/* Collection Rate */}
                <div className="total-card collection-rate">
                    <div className="total-label">Collection Rate</div>
                    <div className="total-value">
                        {paymentService.formatPercentage(summary.collectionRate || 0)}
                    </div>
                    <div className="collection-bar-container">
                        <div 
                            className="collection-bar"
                            style={{ width: `${Math.min(summary.collectionRate || 0, 100)}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentSummary;
