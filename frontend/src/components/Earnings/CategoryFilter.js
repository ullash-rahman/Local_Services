import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * CategoryFilter - Multi-select dropdown component for filtering earnings by category
 * 
 * Features:
 * - Multi-select dropdown for category filtering
 * - Clear filter button
 * - Display active filter count
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
const CategoryFilter = ({
    categories = [],
    selectedCategories = [],
    onCategoryChange,
    onClearFilter,
    disabled = false,
    placeholder = 'Filter by Category'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    /**
     * Toggle dropdown open/close
     */
    const toggleDropdown = () => {
        if (!disabled) {
            setIsOpen(!isOpen);
        }
    };

    /**
     * Handle category selection toggle
     * @param {string} category - Category to toggle
     */
    const handleCategoryToggle = (category) => {
        if (onCategoryChange) {
            onCategoryChange(category);
        }
    };

    /**
     * Handle clear all filters
     */
    const handleClearFilter = (e) => {
        e.stopPropagation();
        if (onClearFilter) {
            onClearFilter();
        }
    };

    /**
     * Handle select all categories
     */
    const handleSelectAll = () => {
        if (onCategoryChange && categories.length > 0) {
            // If all are selected, deselect all; otherwise select all
            if (selectedCategories.length === categories.length) {
                onClearFilter && onClearFilter();
            } else {
                categories.forEach(category => {
                    if (!selectedCategories.includes(category)) {
                        onCategoryChange(category);
                    }
                });
            }
        }
    };

    const activeCount = selectedCategories.length;
    const hasActiveFilters = activeCount > 0;
    const allSelected = categories.length > 0 && selectedCategories.length === categories.length;

    /**
     * Get display text for the dropdown button
     */
    const getDisplayText = () => {
        if (activeCount === 0) {
            return placeholder;
        }
        if (activeCount === 1) {
            return selectedCategories[0];
        }
        return `${activeCount} categories selected`;
    };

    // Don't render if no categories available
    if (!categories || categories.length === 0) {
        return null;
    }

    return (
        <div 
            className={`category-filter-dropdown ${disabled ? 'disabled' : ''}`}
            ref={dropdownRef}
        >
            {/* Dropdown Toggle Button */}
            <button
                type="button"
                className={`category-filter-toggle ${isOpen ? 'open' : ''} ${hasActiveFilters ? 'has-filters' : ''}`}
                onClick={toggleDropdown}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className="filter-icon">🏷️</span>
                <span className="filter-text">{getDisplayText()}</span>
                {hasActiveFilters && (
                    <span className="filter-count">{activeCount}</span>
                )}
                <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
            </button>

            {/* Clear Filter Button (shown when filters are active) */}
            {hasActiveFilters && (
                <button
                    type="button"
                    className="clear-filter-button"
                    onClick={handleClearFilter}
                    title="Clear all filters"
                    aria-label="Clear all category filters"
                >
                    ✕
                </button>
            )}

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="category-filter-menu" role="listbox" aria-multiselectable="true">
                    {/* Select All Option */}
                    <div className="category-filter-header">
                        <button
                            type="button"
                            className="select-all-btn"
                            onClick={handleSelectAll}
                        >
                            {allSelected ? 'Deselect All' : 'Select All'}
                        </button>
                        {hasActiveFilters && (
                            <span className="active-filter-info">
                                {activeCount} of {categories.length} selected
                            </span>
                        )}
                    </div>

                    {/* Category Options */}
                    <div className="category-filter-options">
                        {categories.map((category) => {
                            const isSelected = selectedCategories.includes(category);
                            return (
                                <label
                                    key={category}
                                    className={`category-option ${isSelected ? 'selected' : ''}`}
                                    role="option"
                                    aria-selected={isSelected}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleCategoryToggle(category)}
                                        className="category-checkbox"
                                    />
                                    <span className="category-checkbox-custom">
                                        {isSelected && '✓'}
                                    </span>
                                    <span className="category-label">{category}</span>
                                </label>
                            );
                        })}
                    </div>

                    {/* Footer with active filter display */}
                    {hasActiveFilters && (
                        <div className="category-filter-footer">
                            <div className="selected-categories">
                                {selectedCategories.map((category) => (
                                    <span key={category} className="selected-category-tag">
                                        {category}
                                        <button
                                            type="button"
                                            className="remove-category-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleCategoryToggle(category);
                                            }}
                                            aria-label={`Remove ${category} filter`}
                                        >
                                            ✕
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

CategoryFilter.propTypes = {
    /** Array of available category names */
    categories: PropTypes.arrayOf(PropTypes.string),
    /** Array of currently selected category names */
    selectedCategories: PropTypes.arrayOf(PropTypes.string),
    /** Callback when a category is toggled (receives category name) */
    onCategoryChange: PropTypes.func.isRequired,
    /** Callback when clear filter button is clicked */
    onClearFilter: PropTypes.func.isRequired,
    /** Whether the filter is disabled */
    disabled: PropTypes.bool,
    /** Placeholder text when no categories are selected */
    placeholder: PropTypes.string
};

export default CategoryFilter;
