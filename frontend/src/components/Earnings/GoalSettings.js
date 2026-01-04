import React, { useState, useEffect, useCallback } from 'react';
import { authService } from '../../services/authService';
import earningsService from '../../services/earningsService';
import './Earnings.css';

/**
 * GoalSettings - Component for managing earnings goals
 * Provides form for setting daily and monthly earnings goals,
 * displays current goals with progress bars, and allows editing/deleting goals.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
const GoalSettings = ({ onGoalUpdate }) => {
    // Get current user
    const user = authService.getCurrentUser();
    const providerID = user?.userID;

    // Goals state
    const [goals, setGoals] = useState([]);
    const [goalProgress, setGoalProgress] = useState({});

    // Form state
    const [formData, setFormData] = useState({
        goalType: 'daily',
        targetAmount: ''
    });
    const [editingGoal, setEditingGoal] = useState(null);

    // UI state
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    /**
     * Fetch active goals and their progress
     */
    const fetchGoals = useCallback(async () => {
        if (!providerID) return;
        
        setIsLoading(true);
        setError(null);

        try {
            const goalsData = await earningsService.getActiveGoals(providerID);
            setGoals(goalsData || []);

            // Fetch progress for each goal
            const progressPromises = (goalsData || []).map(async (goal) => {
                try {
                    const progress = await earningsService.getGoalProgress(providerID, goal.goalID);
                    return { goalID: goal.goalID, progress };
                } catch (err) {
                    console.error(`Error fetching progress for goal ${goal.goalID}:`, err);
                    return { goalID: goal.goalID, progress: null };
                }
            });

            const progressResults = await Promise.all(progressPromises);
            const progressMap = {};
            progressResults.forEach(({ goalID, progress }) => {
                progressMap[goalID] = progress;
            });
            setGoalProgress(progressMap);
        } catch (err) {
            console.error('Error fetching goals:', err);
            setError('Failed to load goals');
        } finally {
            setIsLoading(false);
        }
    }, [providerID]);

    // Initial fetch
    useEffect(() => {
        fetchGoals();
    }, [fetchGoals]);

    /**
     * Handle form input changes
     */
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    /**
     * Handle form submission for creating/updating a goal
     */
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!providerID) {
            setError('User not authenticated');
            return;
        }

        const targetAmount = parseFloat(formData.targetAmount);
        if (isNaN(targetAmount) || targetAmount <= 0) {
            setError('Please enter a valid positive amount');
            return;
        }

        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const goalData = {
                goalType: formData.goalType,
                targetAmount: targetAmount
            };

            await earningsService.setGoal(providerID, goalData);
            
            setSuccessMessage(
                editingGoal 
                    ? 'Goal updated successfully!' 
                    : 'Goal created successfully!'
            );
            
            // Reset form
            setFormData({
                goalType: 'daily',
                targetAmount: ''
            });
            setEditingGoal(null);

            // Refresh goals
            await fetchGoals();

            // Notify parent component
            if (onGoalUpdate) {
                onGoalUpdate();
            }

            // Clear success message after 3 seconds
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            console.error('Error saving goal:', err);
            setError(err.response?.data?.message || 'Failed to save goal');
        } finally {
            setIsSaving(false);
        }
    };

    /**
     * Handle editing a goal
     */
    const handleEdit = (goal) => {
        setEditingGoal(goal);
        setFormData({
            goalType: goal.goalType,
            targetAmount: goal.targetAmount.toString()
        });
        setError(null);
        setSuccessMessage(null);
    };

    /**
     * Handle canceling edit
     */
    const handleCancelEdit = () => {
        setEditingGoal(null);
        setFormData({
            goalType: 'daily',
            targetAmount: ''
        });
        setError(null);
    };

    /**
     * Handle deleting a goal
     */
    const handleDelete = async (goalID) => {
        if (!window.confirm('Are you sure you want to delete this goal?')) {
            return;
        }

        setError(null);
        setSuccessMessage(null);

        try {
            await earningsService.deleteGoal(providerID, goalID);
            setSuccessMessage('Goal deleted successfully!');
            
            // Refresh goals
            await fetchGoals();

            // Notify parent component
            if (onGoalUpdate) {
                onGoalUpdate();
            }

            // Clear success message after 3 seconds
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            console.error('Error deleting goal:', err);
            setError(err.response?.data?.message || 'Failed to delete goal');
        }
    };

    /**
     * Get progress data for a goal
     */
    const getGoalProgressData = (goalID) => {
        return goalProgress[goalID] || null;
    };

    /**
     * Render progress bar for a goal
     */
    const renderProgressBar = (goal) => {
        const progress = getGoalProgressData(goal.goalID);
        if (!progress) return null;

        const percentage = Math.min(progress.progressPercentage, 100);
        const status = earningsService.getProgressStatus(percentage);

        return (
            <div className="goal-progress-display">
                <div className="progress-info">
                    <span className="progress-current">
                        {earningsService.formatCurrency(progress.currentAmount)}
                    </span>
                    <span className="progress-separator">of</span>
                    <span className="progress-target">
                        {earningsService.formatCurrency(progress.targetAmount)}
                    </span>
                </div>
                <div className="progress-bar-container">
                    <div 
                        className={`progress-bar ${status}`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                <div className="progress-details">
                    <span className="progress-percentage">
                        {earningsService.formatPercentage(percentage)}
                    </span>
                    {progress.isAchieved ? (
                        <span className="goal-achieved-badge">✓ Achieved!</span>
                    ) : (
                        <span className="remaining-amount">
                            {earningsService.formatCurrency(progress.remainingAmount)} remaining
                        </span>
                    )}
                </div>
            </div>
        );
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="goal-settings">
                <div className="goal-settings-loading">
                    <div className="loading-spinner"></div>
                    <p>Loading goals...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="goal-settings">
            <div className="goal-settings-header">
                <h2>Earnings Goals</h2>
                <p className="goal-settings-subtitle">
                    Set daily and monthly targets to track your progress
                </p>
            </div>

            {/* Error Message */}
            {error && (
                <div className="goal-message error">
                    <span className="message-icon">⚠️</span>
                    {error}
                </div>
            )}

            {/* Success Message */}
            {successMessage && (
                <div className="goal-message success">
                    <span className="message-icon">✓</span>
                    {successMessage}
                </div>
            )}

            {/* Goal Form */}
            <div className="goal-form-card">
                <h3>{editingGoal ? 'Edit Goal' : 'Set New Goal'}</h3>
                <form onSubmit={handleSubmit} className="goal-form">
                    <div className="form-group">
                        <label htmlFor="goalType">Goal Type</label>
                        <select
                            id="goalType"
                            name="goalType"
                            value={formData.goalType}
                            onChange={handleInputChange}
                            className="form-select"
                            disabled={editingGoal !== null}
                        >
                            <option value="daily">Daily Goal</option>
                            <option value="monthly">Monthly Goal</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="targetAmount">Target Amount ($)</label>
                        <input
                            type="number"
                            id="targetAmount"
                            name="targetAmount"
                            value={formData.targetAmount}
                            onChange={handleInputChange}
                            placeholder="Enter target amount"
                            min="0.01"
                            step="0.01"
                            className="form-input"
                            required
                        />
                    </div>

                    <div className="form-actions">
                        <button 
                            type="submit" 
                            className="btn-primary"
                            disabled={isSaving}
                        >
                            {isSaving ? 'Saving...' : (editingGoal ? 'Update Goal' : 'Set Goal')}
                        </button>
                        {editingGoal && (
                            <button 
                                type="button" 
                                className="btn-secondary"
                                onClick={handleCancelEdit}
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* Current Goals */}
            <div className="current-goals-section">
                <h3>Current Goals</h3>
                {goals.length === 0 ? (
                    <div className="no-goals-message">
                        <span className="no-goals-icon">🎯</span>
                        <p>No active goals set yet.</p>
                        <p className="hint">Set a daily or monthly goal above to start tracking your progress!</p>
                    </div>
                ) : (
                    <div className="goals-list">
                        {goals.map(goal => (
                            <div key={goal.goalID} className="goal-card">
                                <div className="goal-card-header">
                                    <div className="goal-type-badge">
                                        {goal.goalType === 'daily' ? '📅 Daily' : '📆 Monthly'}
                                    </div>
                                    <div className="goal-actions">
                                        <button 
                                            className="btn-icon edit"
                                            onClick={() => handleEdit(goal)}
                                            title="Edit goal"
                                        >
                                            ✏️
                                        </button>
                                        <button 
                                            className="btn-icon delete"
                                            onClick={() => handleDelete(goal.goalID)}
                                            title="Delete goal"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                                <div className="goal-card-body">
                                    <div className="goal-target-amount">
                                        <span className="label">Target:</span>
                                        <span className="amount">
                                            {earningsService.formatCurrency(goal.targetAmount)}
                                        </span>
                                    </div>
                                    {renderProgressBar(goal)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GoalSettings;
