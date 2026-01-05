import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import { paymentService } from '../../services/paymentService';
import PaymentList from './PaymentList';
import PaymentSummary from './PaymentSummary';
import './Payment.css';

/**
 * PaymentCenter - Main page component for payment management
 * Combines PaymentList and PaymentSummary components
 * Provides mark as paid functionality with payment method selection
 * 
 * Requirements: 1.1, 4.1, 6.1
 */
const PaymentCenter = () => {
    const user = authService.getCurrentUser();
    const userId = user?.userID;
    const userRole = user?.role;
    
    // Debug logging
    console.log('PaymentCenter - User Info:', {
        userId,
        userRole,
        user: user
    });

    // State for refresh trigger
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // State for mark as paid modal
    const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [actionError, setActionError] = useState(null);
    const [actionSuccess, setActionSuccess] = useState(null);

    /**
     * Handle mark as paid button click - opens modal
     */
    const handleMarkAsPaidClick = useCallback((payment) => {
        setSelectedPayment(payment);
        setPaymentMethod('');
        setActionError(null);
        setShowMarkPaidModal(true);
    }, []);

    /**
     * Handle mark as paid confirmation
     */
    const handleConfirmMarkAsPaid = async () => {
        if (!selectedPayment) return;

        setIsProcessing(true);
        setActionError(null);

        try {
            await paymentService.markAsPaid(
                selectedPayment.paymentID, 
                paymentMethod || null
            );
            
            setActionSuccess(`Payment #${selectedPayment.paymentID} marked as paid successfully!`);
            setShowMarkPaidModal(false);
            setSelectedPayment(null);
            
            // Trigger refresh of list and summary
            setRefreshTrigger(prev => prev + 1);

            // Clear success message after 3 seconds
            setTimeout(() => setActionSuccess(null), 3000);
        } catch (err) {
            console.error('Error marking payment as paid:', err);
            setActionError(err.response?.data?.error?.message || 'Failed to mark payment as paid');
        } finally {
            setIsProcessing(false);
        }
    };

    /**
     * Handle modal close
     */
    const handleCloseModal = () => {
        setShowMarkPaidModal(false);
        setSelectedPayment(null);
        setPaymentMethod('');
        setActionError(null);
    };

    /**
     * Check for overdue payments
     */
    const handleCheckOverdue = async () => {
        try {
            const result = await paymentService.checkOverduePayments(userId);
            if (result.overdueCount > 0) {
                setActionSuccess(`${result.overdueCount} payment(s) marked as overdue`);
                setRefreshTrigger(prev => prev + 1);
            } else {
                setActionSuccess('No new overdue payments found');
            }
            setTimeout(() => setActionSuccess(null), 3000);
        } catch (err) {
            console.error('Error checking overdue payments:', err);
            setActionError('Failed to check overdue payments');
            setTimeout(() => setActionError(null), 3000);
        }
    };

    return (
        <div className="payment-center">
            {/* Show authentication message if user is not authenticated */}
            {(!user || !userId) ? (
                <div className="payment-center-error">
                    <p>Please log in to view payments.</p>
                </div>
            ) : (
                <>
            {/* Header */}
            <div className="payment-center-header">
                <div className="header-title">
                    <h1>Payment Center</h1>
                    <p className="header-subtitle">
                        {userRole === 'Provider' 
                            ? 'Track and manage your service payments'
                            : 'View your payment history and obligations'
                        }
                    </p>
                </div>
                <div className="header-actions">
                    <Link 
                        to={userRole === 'Provider' ? '/dashboard/provider' : '/dashboard/customer'} 
                        className="back-link"
                    >
                        ← Back to Dashboard
                    </Link>
                    {userRole === 'Provider' && (
                        <button 
                            className="check-overdue-btn"
                            onClick={handleCheckOverdue}
                        >
                            Check Overdue
                        </button>
                    )}
                </div>
            </div>

            {/* Success/Error Messages */}
            {actionSuccess && (
                <div className="action-message success">
                    <span className="message-icon">✓</span>
                    {actionSuccess}
                </div>
            )}
            {actionError && (
                <div className="action-message error">
                    <span className="message-icon">⚠️</span>
                    {actionError}
                </div>
            )}

            {/* Payment Summary - Only for Providers */}
            {userRole === 'Provider' && (
                <div className="payment-center-section">
                    <h2 className="section-title">Payment Summary</h2>
                    <PaymentSummary 
                        providerId={userId}
                        refreshTrigger={refreshTrigger}
                    />
                </div>
            )}

            {/* Payment List */}
            <div className="payment-center-section">
                <h2 className="section-title">
                    {userRole === 'Provider' ? 'All Payments' : 'Your Payments'}
                </h2>
                <PaymentList 
                    userId={userId}
                    userRole={userRole}
                    onMarkAsPaid={handleMarkAsPaidClick}
                    refreshTrigger={refreshTrigger}
                />
            </div>

            {/* Mark as Paid Modal */}
            {showMarkPaidModal && selectedPayment && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Mark Payment as Paid</h3>
                            <button className="modal-close" onClick={handleCloseModal}>
                                ×
                            </button>
                        </div>
                        
                        <div className="modal-body">
                            <div className="payment-details">
                                <div className="detail-row">
                                    <span className="detail-label">Service:</span>
                                    <span className="detail-value">{selectedPayment.category}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Customer:</span>
                                    <span className="detail-value">{selectedPayment.customerName}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Amount:</span>
                                    <span className="detail-value amount">
                                        {paymentService.formatCurrency(selectedPayment.amount)}
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Status:</span>
                                    <span 
                                        className={`detail-value status-badge ${paymentService.getStatusColorClass(selectedPayment.status)}`}
                                        style={{
                                            backgroundColor: paymentService.getStatusBackgroundColor(selectedPayment.status),
                                            color: paymentService.getStatusColor(selectedPayment.status)
                                        }}
                                    >
                                        {selectedPayment.status}
                                    </span>
                                </div>
                            </div>

                            <div className="payment-method-select">
                                <label htmlFor="payment-method">Payment Method (Optional):</label>
                                <select
                                    id="payment-method"
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    className="method-select"
                                >
                                    <option value="">Select method...</option>
                                    {paymentService.paymentMethodOptions.map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {actionError && (
                                <div className="modal-error">
                                    {actionError}
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button 
                                className="btn-cancel"
                                onClick={handleCloseModal}
                                disabled={isProcessing}
                            >
                                Cancel
                            </button>
                            <button 
                                className="btn-confirm"
                                onClick={handleConfirmMarkAsPaid}
                                disabled={isProcessing}
                            >
                                {isProcessing ? 'Processing...' : 'Confirm Payment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
                </>
            )}
        </div>
    );
};

export default PaymentCenter;
