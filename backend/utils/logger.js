const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

// Get current log level from environment
const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

function formatLogMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaString = Object.keys(meta).length > 0 
        ? ` | ${JSON.stringify(meta)}` 
        : '';
    
    return `[${timestamp}] [${level}] ${message}${metaString}`;
}

class Logger {
    constructor(context = 'App') {
        this.context = context;
    }

    error(message, errorOrMeta = {}) {
        if (currentLogLevel >= LOG_LEVELS.ERROR) {
            const meta = this._buildMeta(errorOrMeta);
            console.error(formatLogMessage('ERROR', `[${this.context}] ${message}`, meta));
        }
    }

    warn(message, meta = {}) {
        if (currentLogLevel >= LOG_LEVELS.WARN) {
            console.warn(formatLogMessage('WARN', `[${this.context}] ${message}`, meta));
        }
    }

    info(message, meta = {}) {
        if (currentLogLevel >= LOG_LEVELS.INFO) {
            console.log(formatLogMessage('INFO', `[${this.context}] ${message}`, meta));
        }
    }

    debug(message, meta = {}) {
        if (currentLogLevel >= LOG_LEVELS.DEBUG) {
            console.log(formatLogMessage('DEBUG', `[${this.context}] ${message}`, meta));
        }
    }

    logRequest(req, additionalMeta = {}) {
        const meta = {
            method: req.method,
            path: req.path,
            userID: req.user?.userID,
            ip: req.ip,
            ...additionalMeta
        };
        this.info(`${req.method} ${req.path}`, meta);
    }

    logResponse(req, res, duration) {
        const meta = {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userID: req.user?.userID
        };
        
        if (res.statusCode >= 400) {
            this.warn(`${req.method} ${req.path} - ${res.statusCode}`, meta);
        } else {
            this.info(`${req.method} ${req.path} - ${res.statusCode}`, meta);
        }
    }

    logDbOperation(operation, meta = {}) {
        this.debug(`DB: ${operation}`, meta);
    }

    logDbError(operation, error, meta = {}) {
        this.error(`DB Error: ${operation}`, {
            ...meta,
            errorCode: error.code,
            errorMessage: error.message
        });
    }

    _buildMeta(errorOrMeta) {
        if (errorOrMeta instanceof Error) {
            return {
                errorName: errorOrMeta.name,
                errorMessage: errorOrMeta.message,
                errorCode: errorOrMeta.code,
                errorType: errorOrMeta.errorType,
                stack: process.env.NODE_ENV === 'development' ? errorOrMeta.stack : undefined
            };
        }
        return errorOrMeta;
    }
}

// Create default logger instances for different contexts
const reviewLogger = new Logger('Review');
const validatorLogger = new Logger('Validator');
const analyticsLogger = new Logger('Analytics');
const moderationLogger = new Logger('Moderation');
const dbLogger = new Logger('Database');

module.exports = {
    Logger,
    reviewLogger,
    validatorLogger,
    analyticsLogger,
    moderationLogger,
    dbLogger,
    LOG_LEVELS
};

