/**
 * Centralized Currency Configuration
 * All currency formatting across the application uses this configuration
 * to ensure consistency between Payment, Earnings, Analytics, and Gamification features.
 */

// Currency configuration - Change this to update currency across the entire app
export const CURRENCY_CONFIG = {
    code: 'USD',           // ISO 4217 currency code
    symbol: '$',           // Currency symbol
    locale: 'en-US',       // Locale for formatting
    name: 'US Dollar',
    decimalPlaces: 2
};

/**
 * Format a numeric value as currency
 * @param {number} value - The amount to format
 * @param {Object} options - Optional formatting options
 * @param {boolean} options.showSymbol - Whether to show currency symbol (default: true)
 * @param {boolean} options.compact - Use compact notation for large numbers (default: false)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value, options = {}) => {
    const { showSymbol = true, compact = false } = options;
    
    if (value === null || value === undefined || isNaN(value)) {
        return showSymbol ? `${CURRENCY_CONFIG.symbol}0.00` : '0.00';
    }

    try {
        const formatOptions = {
            style: showSymbol ? 'currency' : 'decimal',
            currency: CURRENCY_CONFIG.code,
            minimumFractionDigits: CURRENCY_CONFIG.decimalPlaces,
            maximumFractionDigits: CURRENCY_CONFIG.decimalPlaces
        };

        if (compact && Math.abs(value) >= 1000) {
            formatOptions.notation = 'compact';
            formatOptions.compactDisplay = 'short';
        }

        // Use en-US locale for USD formatting
        return new Intl.NumberFormat('en-US', formatOptions).format(value);
    } catch (error) {
        // Fallback formatting if Intl fails
        const formatted = Number(value).toFixed(CURRENCY_CONFIG.decimalPlaces);
        return showSymbol ? `${CURRENCY_CONFIG.symbol}${formatted}` : formatted;
    }
};

/**
 * Format currency for display in compact form (e.g., ৳1.5K, ৳2.3M)
 * @param {number} value - The amount to format
 * @returns {string} Compact formatted currency string
 */
export const formatCurrencyCompact = (value) => {
    return formatCurrency(value, { compact: true });
};

/**
 * Parse a currency string back to a number
 * @param {string} currencyString - The formatted currency string
 * @returns {number} The numeric value
 */
export const parseCurrency = (currencyString) => {
    if (!currencyString) return 0;
    
    // Remove currency symbol, commas, and spaces
    const cleaned = currencyString
        .replace(CURRENCY_CONFIG.symbol, '')
        .replace(/[,\s]/g, '')
        .trim();
    
    return parseFloat(cleaned) || 0;
};

/**
 * Get the currency symbol
 * @returns {string} Currency symbol
 */
export const getCurrencySymbol = () => CURRENCY_CONFIG.symbol;

/**
 * Get the currency code
 * @returns {string} Currency code (e.g., 'BDT')
 */
export const getCurrencyCode = () => CURRENCY_CONFIG.code;

/**
 * Get the full currency name
 * @returns {string} Currency name (e.g., 'Bangladeshi Taka')
 */
export const getCurrencyName = () => CURRENCY_CONFIG.name;

export default {
    CURRENCY_CONFIG,
    formatCurrency,
    formatCurrencyCompact,
    parseCurrency,
    getCurrencySymbol,
    getCurrencyCode,
    getCurrencyName
};
