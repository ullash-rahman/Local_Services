class AppError extends Error {
    constructor(message, statusCode = 500, errorType = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.errorType = errorType;
        this.isOperational = true;
        this.timestamp = new Date().toISOString();
        
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message, errors = []) {
        super(message, 400, 'VALIDATION_ERROR');
        this.errors = errors;
    }
}

class AuthenticationError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401, 'AUTHENTICATION_ERROR');
    }
}

class AuthorizationError extends AppError {
    constructor(message = 'Access denied. Insufficient permissions.') {
        super(message, 403, 'AUTHORIZATION_ERROR');
    }
}

class NotFoundError extends AppError {
    constructor(resource = 'Resource', identifier = '') {
        const message = identifier 
            ? `${resource} with ID ${identifier} not found`
            : `${resource} not found`;
        super(message, 404, 'NOT_FOUND_ERROR');
        this.resource = resource;
    }
}

class ConflictError extends AppError {
    constructor(message = 'Resource conflict') {
        super(message, 409, 'CONFLICT_ERROR');
    }
}

class DatabaseError extends AppError {
    constructor(message = 'Database operation failed', originalError = null) {
        super(message, 500, 'DATABASE_ERROR');
        this.originalError = originalError;
    }
}

class TransactionError extends AppError {
    constructor(message = 'Transaction failed, please try again', originalError = null) {
        super(message, 500, 'TRANSACTION_ERROR');
        this.originalError = originalError;
    }
}

class RateLimitError extends AppError {
    constructor(message = 'Too many requests. Please try again later.') {
        super(message, 429, 'RATE_LIMIT_ERROR');
    }
}

// Error code mappings for consistent error responses
const ErrorCodes = {
    // Validation errors (400)
    INVALID_RATING: { code: 'E001', message: 'Rating must be between 1 and 5 stars' },
    REVIEW_TOO_LONG: { code: 'E002', message: 'Review exceeds 500 character limit' },
    REPLY_TOO_LONG: { code: 'E003', message: 'Reply exceeds 300 character limit' },
    EMPTY_CONTENT: { code: 'E004', message: 'Content cannot be empty or whitespace only' },
    MISSING_REQUIRED_FIELD: { code: 'E005', message: 'Missing required field' },
    INVALID_ID: { code: 'E006', message: 'Invalid ID format' },
    RATING_REQUIRED: { code: 'E007', message: 'Rating is required' },
    
    // Authorization errors (403)
    UNAUTHORIZED_REVIEW: { code: 'E101', message: 'Only customers who received this service can submit reviews' },
    UNAUTHORIZED_REPLY: { code: 'E102', message: 'Only the service provider can reply to this review' },
    INSUFFICIENT_PERMISSIONS: { code: 'E103', message: 'Insufficient permissions for this action' },
    
    // Conflict errors (409)
    DUPLICATE_REVIEW: { code: 'E201', message: 'You have already reviewed this service' },
    DUPLICATE_REPLY: { code: 'E202', message: 'You have already replied to this review' },
    ALREADY_MODERATED: { code: 'E203', message: 'Content has already been moderated' },
    ALREADY_HIDDEN: { code: 'E204', message: 'This review has already been hidden' },
    
    // Business logic errors (400)
    SERVICE_NOT_COMPLETED: { code: 'E301', message: 'Reviews can only be submitted for completed services' },
    
    // Not found errors (404)
    SERVICE_NOT_FOUND: { code: 'E401', message: 'Service request not found' },
    REVIEW_NOT_FOUND: { code: 'E402', message: 'Review not found' },
    USER_NOT_FOUND: { code: 'E403', message: 'User not found' },
    
    // Database errors (500)
    DATABASE_CONNECTION: { code: 'E501', message: 'Database connection error' },
    DATABASE_CONSTRAINT: { code: 'E502', message: 'Data integrity error' },
    TRANSACTION_FAILED: { code: 'E503', message: 'Transaction failed, please try again' },
    
    // General errors (500)
    INTERNAL_ERROR: { code: 'E999', message: 'Internal server error' }
};

function formatErrorResponse(error, includeStack = false) {
    const response = {
        success: false,
        message: error.message || 'An unexpected error occurred',
        errorType: error.errorType || 'INTERNAL_ERROR',
        timestamp: error.timestamp || new Date().toISOString()
    };

    // Include error code if available
    if (error.code) {
        response.code = error.code;
    }

    // Include validation errors if available
    if (error.errors && Array.isArray(error.errors) && error.errors.length > 0) {
        response.errors = error.errors;
    }

    // Include stack trace in development mode
    if (includeStack && error.stack) {
        response.stack = error.stack;
    }

    return response;
}

function isOperationalError(error) {
    if (error instanceof AppError) {
        return error.isOperational;
    }
    return false;
}

function mapDatabaseError(error) {
    // MySQL error codes
    const errorCode = error.code || error.errno;
    
    switch (errorCode) {
        case 'ER_DUP_ENTRY':
        case 1062:
            return new ConflictError('Duplicate entry detected');
        
        case 'ER_NO_REFERENCED_ROW':
        case 'ER_NO_REFERENCED_ROW_2':
        case 1452:
            return new ValidationError('Referenced record does not exist');
        
        case 'ER_ROW_IS_REFERENCED':
        case 'ER_ROW_IS_REFERENCED_2':
        case 1451:
            return new ConflictError('Cannot delete record that is referenced by other records');
        
        case 'ECONNREFUSED':
        case 'PROTOCOL_CONNECTION_LOST':
        case 'ER_CON_COUNT_ERROR':
            return new DatabaseError('Database connection error');
        
        case 'ER_LOCK_DEADLOCK':
        case 1213:
            return new TransactionError('Transaction deadlock detected, please retry');
        
        case 'ER_LOCK_WAIT_TIMEOUT':
        case 1205:
            return new TransactionError('Transaction timeout, please retry');
        
        default:
            return new DatabaseError(
                process.env.NODE_ENV === 'development' 
                    ? `Database error: ${error.message}` 
                    : 'Database operation failed',
                error
            );
    }
}

module.exports = {
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    DatabaseError,
    TransactionError,
    RateLimitError,
    ErrorCodes,
    formatErrorResponse,
    isOperationalError,
    mapDatabaseError
};

