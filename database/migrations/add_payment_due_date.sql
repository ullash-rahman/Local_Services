-- Migration: Add dueDate column to Payment table
-- This migration adds the missing dueDate column to the Payment table
-- and creates an index for better query performance

USE local_services_db;

-- Add dueDate column if it doesn't exist
ALTER TABLE Payment 
ADD COLUMN IF NOT EXISTS dueDate DATE AFTER status;

-- Add index for dueDate if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_due_date ON Payment(dueDate);

-- Add composite indexes for better performance
CREATE INDEX IF NOT EXISTS idx_status_due_date ON Payment(status, dueDate);
CREATE INDEX IF NOT EXISTS idx_provider_status ON Payment(requestID) 
USING BTREE;

-- Update existing payments to have a default due date (7 days from creation)
UPDATE Payment 
SET dueDate = DATE_ADD(DATE(createdAt), INTERVAL 7 DAY) 
WHERE dueDate IS NULL AND status = 'Pending';

-- Add additional performance indexes to ServiceRequest table
CREATE INDEX IF NOT EXISTS idx_priority_level ON ServiceRequest(priorityLevel);
CREATE INDEX IF NOT EXISTS idx_status_provider ON ServiceRequest(status, providerID);
CREATE INDEX IF NOT EXISTS idx_category_status ON ServiceRequest(category, status);

-- Verify the changes
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE, 
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'local_services_db' 
    AND TABLE_NAME = 'Payment' 
    AND COLUMN_NAME = 'dueDate';

-- Show indexes on Payment table
SHOW INDEX FROM Payment;