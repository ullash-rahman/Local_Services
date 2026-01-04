import React, { useState, useEffect, useCallback } from 'react';
import { paymentService } from '../../services/paymentService';
import './Payment.css';

/**
 * PaymentList - Displays payments in table format with filtering
 * Shows status with color coding (Pending: yellow, Paid: green, Overdue: red)
 * Includes filter controls for status and date range
 * 
 * Requirements: 1.1, 1.3, 5.1, 5.2
 */
const PaymentList = ({ 
    userId, 
    userRole, // 'Provider' or 'Customer'
    onMarkAsPaid,
    refreshTrigger 
}) => {
    // Filter state
    const [statusFilter, setStatusFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Data state
    const [payments, setPayments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    /**
     * Fetch payments based on user role and filters
     */
    const fetchPayments = useCallback(async () => {
        if (!userId) return;
        
        setIsLoading(true);
        setError(null);

        try {
            const filters = {};
            if (statusFilter) filters.status = statusFilter;
            if (startDate) filters.startDate = startDate;
            if (endDate) filters.endDate = endDate;

            let data;
            if (userRole === 'Provider') {
                data = await paymentService.getPaymentsByProvider(userId, filters);
            } else {
                data = await paymentService.getPaymentsByCustomer(userId, filters);
            }
            setPayments(data || []);
        } catch (err) {
            console.error('Error fetching payments:', err);
            setError('Failed to load payments');
        } finally {
            setIsLoading(false);
        }
    }, [userId, userRole, statusFilter, startDate, endDate]);

    // Fetch payments on mount and when filters change
    useEffect(() => {
        fetchPayments();
    }, [fetchPayments, refreshTrigger]);

    /**
     * Handle status filter change
     */
    const handleStatusChange = (e) => {
        setStatusFilter(e.target.value);
    };

    /**
     * Handle date filter changes
     */
    const handleStartDateChange = (e) => {
        setStartDate(e.target.value);
    };

    const handleEndDateChange = (e) => {
        setEndDate(e.target.value);
    };

    /**
     * Clear all filters
     */
    const clearFilters = () => {
        setStatusFilter('');
        setStartDate('');
        setEndDate('');
    };

    /**
     * Check if any filters are active
     */
    const hasActiveFilters = statusFilter || startDate || endDate;

    // Loading state
    if (isLoading) {
        return (
            <div className="payment-list-loading">
                <div className="loading-spinner"></div>
                <p>Loading payments...</p>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="payment-list-error">
                <div className="error-icon">⚠️</div>
                <p>{error}</p>
                <button className="retry-button" onClick={fetchPayments}>
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="payment-list">
            {/* Filter Controls */}
            <div className="payment-filters">
                <div className="filter-group">
                    <label htmlFor="status-filter">Status:</label>
                    <select
                        id="status-filter"
                        value={statusFilter}
                        onChange={handleStatusChange}
                        className="filter-select"
                    >
                        {paymentService.statusOptions.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <label htmlFor="start-date">From:</label>
                    <input
                        type="date"
                        id="start-date"
                        value={startDate}
                        onChange={handleStartDateChange}
                        className="filter-date"
                    />
                </div>

                <div className="filter-group">
                    <label htmlFor="end-date">To:</label>
                    <input
                        type="date"
                        id="end-date"
                        value={endDate}
                        onChange={handleEndDateChange}
                        className="filter-date"
                    />
                </div>

                {hasActiveFilters && (
                    <button className="clear-filters-btn" onClick={clearFilters}>
                        Clear Filters
                    </button>
                )}
            </div>

            {/* Payments Table */}
            {payments.length === 0 ? (
                <div className="payment-list-empty">
                    <div className="empty-icon">💳</div>
                    <h3>No Payments Found</h3>
                    <p>
                        {hasActiveFilters 
                            ? 'No payments match your current filters.'
                            : 'You have no payment records yet.'
                        }
                    </p>
                </div>
            ) : (
                <div className="payment-table-container">
                    <table className="payment-table">
                        <thead>
                            <tr>
                                <th>Service</th>
                                <th>{userRole === 'Provider' ? 'Customer' : 'Provider'}</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Due Date</th>
                                <th>Payment Date</th>
                                {userRole === 'Provider' && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {payments.map(payment => (
                                <PaymentRow 
                                    key={payment.paymentID}
                                    payment={payment}
                                    userRole={userRole}
                                    onMarkAsPaid={onMarkAsPaid}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Results count */}
            {payments.length > 0 && (
                <div className="payment-list-footer">
                    <span className="results-count">
                        Showing {payments.length} payment{payments.length !== 1 ? 's' : ''}
                    </span>
                </div>
            )}
        </div>
    );
};

/**
 * PaymentRow - Individual payment row component
 */
const PaymentRow = ({ payment, userRole, onMarkAsPaid }) => {
    const statusClass = paymentService.getStatusColorClass(payment.status);
    const dueDateInfo = paymentService.getDueDateInfo(payment.dueDate);
    const canMarkAsPaid = userRole === 'Provider' && payment.status !== 'Paid';

    return (
        <tr className={payment.status === 'Overdue' ? 'overdue-row' : ''}>
            <td>
                <div className="service-info">
                    <span className="service-category">{payment.category}</span>
                    <span className="service-description">{payment.description}</span>
                </div>
            </td>
            <td>
                {userRole === 'Provider' ? payment.customerName : payment.providerName}
            </td>
            <td className="amount-cell">
                {paymentService.formatCurrency(payment.amount)}
            </td>
            <td>
                <span 
                    className={`status-badge ${statusClass}`}
                    style={{ 
                        backgroundColor: paymentService.getStatusBackgroundColor(payment.status),
                        color: paymentService.getStatusColor(payment.status)
                    }}
                >
                    {payment.status}
                </span>
            </td>
            <td>
                <div className="due-date-cell">
                    <span>{paymentService.formatDate(payment.dueDate)}</span>
                    {payment.status !== 'Paid' && dueDateInfo.label && (
                        <span className={`due-date-label ${dueDateInfo.isOverdue ? 'overdue' : ''}`}>
                            {dueDateInfo.label}
                        </span>
                    )}
                </div>
            </td>
            <td>
                {payment.paymentDate 
                    ? paymentService.formatDate(payment.paymentDate)
                    : '-'
                }
            </td>
            {userRole === 'Provider' && (
                <td>
                    {canMarkAsPaid && (
                        <button 
                            className="mark-paid-btn"
                            onClick={() => onMarkAsPaid && onMarkAsPaid(payment)}
                        >
                            Mark Paid
                        </button>
                    )}
                </td>
            )}
        </tr>
    );
};

export default PaymentList;
