-- Database Synchronization Verification Script
-- This script checks if all tables and columns are properly synchronized

USE local_services_db;

-- Check if all required tables exist
SELECT 
    'Table Existence Check' as CheckType,
    TABLE_NAME as TableName,
    'EXISTS' as Status
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'local_services_db' 
    AND TABLE_NAME IN (
        'USER', 'ServiceRequest', 'Payment', 'Review', 'Booking',
        'Availability', 'Notification', 'Chat', 'Complaint',
        'Analytics', 'Gamification', 'JobHistory', 'MaintenanceReminder',
        'ServiceBundle', 'ServiceCompletion', 'ProviderGoal',
        'ScheduledReport', 'GeneratedReport', 'PerformanceAlert',
        'PlatformBenchmark', 'EarningsGoal'
    )
ORDER BY TABLE_NAME;

-- Check Payment table structure (focus on dueDate column)
SELECT 
    'Payment Table Structure' as CheckType,
    COLUMN_NAME as ColumnName,
    DATA_TYPE as DataType,
    IS_NULLABLE as Nullable,
    COLUMN_DEFAULT as DefaultValue
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'local_services_db' 
    AND TABLE_NAME = 'Payment'
ORDER BY ORDINAL_POSITION;

-- Check indexes on Payment table
SELECT 
    'Payment Table Indexes' as CheckType,
    INDEX_NAME as IndexName,
    COLUMN_NAME as ColumnName,
    NON_UNIQUE as NonUnique
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = 'local_services_db' 
    AND TABLE_NAME = 'Payment'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- Check ServiceRequest table indexes
SELECT 
    'ServiceRequest Table Indexes' as CheckType,
    INDEX_NAME as IndexName,
    COLUMN_NAME as ColumnName,
    NON_UNIQUE as NonUnique
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = 'local_services_db' 
    AND TABLE_NAME = 'ServiceRequest'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- Check Gamification table structure
SELECT 
    'Gamification Table Structure' as CheckType,
    COLUMN_NAME as ColumnName,
    DATA_TYPE as DataType,
    IS_NULLABLE as Nullable
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'local_services_db' 
    AND TABLE_NAME = 'Gamification'
ORDER BY ORDINAL_POSITION;

-- Check foreign key relationships
SELECT 
    'Foreign Key Relationships' as CheckType,
    CONSTRAINT_NAME as ConstraintName,
    TABLE_NAME as TableName,
    COLUMN_NAME as ColumnName,
    REFERENCED_TABLE_NAME as ReferencedTable,
    REFERENCED_COLUMN_NAME as ReferencedColumn
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = 'local_services_db' 
    AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, CONSTRAINT_NAME;

-- Sample data check
SELECT 'Sample Data Check' as CheckType, 'USER' as TableName, COUNT(*) as RecordCount FROM USER
UNION ALL
SELECT 'Sample Data Check', 'ServiceRequest', COUNT(*) FROM ServiceRequest
UNION ALL
SELECT 'Sample Data Check', 'Payment', COUNT(*) FROM Payment
UNION ALL
SELECT 'Sample Data Check', 'Gamification', COUNT(*) FROM Gamification;

-- Check for any payments without due dates (should be 0 after migration)
SELECT 
    'Data Integrity Check' as CheckType,
    'Payments without dueDate' as Description,
    COUNT(*) as Count
FROM Payment 
WHERE dueDate IS NULL AND status = 'Pending';

SELECT 'Verification completed at' as CheckType, NOW() as Timestamp;