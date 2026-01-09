-- Migration: Add ReviewReply table for conversation threads on reviews
-- Run this migration to enable customer replies to provider responses

USE local_services_db;

-- Add replyDate column to Review table if it doesn't exist
ALTER TABLE Review ADD COLUMN IF NOT EXISTS replyDate DATETIME AFTER reply;

-- Create ReviewReply table for conversation threads
CREATE TABLE IF NOT EXISTS ReviewReply (
    replyID INT PRIMARY KEY AUTO_INCREMENT,
    reviewID INT NOT NULL,
    userID INT NOT NULL,
    userRole ENUM('Customer', 'Provider') NOT NULL,
    replyText TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reviewID) REFERENCES Review(reviewID) ON DELETE CASCADE,
    FOREIGN KEY (userID) REFERENCES USER(userID) ON DELETE CASCADE,
    INDEX idx_review (reviewID),
    INDEX idx_user (userID),
    INDEX idx_created (createdAt)
);

-- Migrate existing provider replies to the new table (optional - keeps backward compatibility)
-- INSERT INTO ReviewReply (reviewID, userID, userRole, replyText, createdAt)
-- SELECT reviewID, providerID, 'Provider', reply, COALESCE(replyDate, updatedAt)
-- FROM Review WHERE reply IS NOT NULL AND reply != '';
