CREATE DATABASE IF NOT EXISTS local_services_db;
USE local_services_db;

-- =====================================================
-- CORE USER TABLES
-- =====================================================

-- USER Table (Base table for Customer, Provider, Admin)
CREATE TABLE IF NOT EXISTS USER (
    userID INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role ENUM('Customer', 'Provider', 'Admin') NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_verified (verified)
);

-- =====================================================
-- SERVICE REQUEST & BOOKING TABLES
-- =====================================================

-- ServiceRequest Table
CREATE TABLE IF NOT EXISTS ServiceRequest (
    requestID INT PRIMARY KEY AUTO_INCREMENT,
    customerID INT NOT NULL,
    providerID INT,
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    requestDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    serviceDate DATETIME,
    status VARCHAR(50) DEFAULT 'Pending',
    priorityLevel VARCHAR(50) DEFAULT 'Normal',
    completionConfirmed BOOLEAN DEFAULT FALSE,
    cancellationReason TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customerID) REFERENCES USER(userID) ON DELETE CASCADE,
    FOREIGN KEY (providerID) REFERENCES USER(userID) ON DELETE SET NULL,
    INDEX idx_customer (customerID),
    INDEX idx_provider (providerID),
    INDEX idx_status (status),
    INDEX idx_category (category),
    INDEX idx_service_date (serviceDate)
);

-- Booking Table
CREATE TABLE IF NOT EXISTS Booking (
    bookingID INT PRIMARY KEY AUTO_INCREMENT,
    requestID INT NOT NULL,
    providerID INT NOT NULL,
    scheduledDate DATE NOT NULL,
    scheduledTime TIME,
    manualBooking BOOLEAN DEFAULT FALSE,
    cancellationReason TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (requestID) REFERENCES ServiceRequest(requestID) ON DELETE CASCADE,
    FOREIGN KEY (providerID) REFERENCES USER(userID) ON DELETE CASCADE,
    INDEX idx_request (requestID),
    INDEX idx_provider (providerID),
    INDEX idx_scheduled_date (scheduledDate)
);

-- =====================================================
-- PAYMENT & REVIEW TABLES
-- =====================================================

-- Payment Table
CREATE TABLE IF NOT EXISTS Payment (
    paymentID INT PRIMARY KEY AUTO_INCREMENT,
    requestID INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    paymentDate DATETIME,
    paymentMethod VARCHAR(50),
    transactionID VARCHAR(100),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (requestID) REFERENCES ServiceRequest(requestID) ON DELETE CASCADE,
    INDEX idx_request (requestID),
    INDEX idx_status (status),
    INDEX idx_payment_date (paymentDate)
);

-- Review Table
CREATE TABLE IF NOT EXISTS Review (
    reviewID INT PRIMARY KEY AUTO_INCREMENT,
    requestID INT NOT NULL,
    customerID INT NOT NULL,
    providerID INT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    reply TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (requestID) REFERENCES ServiceRequest(requestID) ON DELETE CASCADE,
    FOREIGN KEY (customerID) REFERENCES USER(userID) ON DELETE CASCADE,
    FOREIGN KEY (providerID) REFERENCES USER(userID) ON DELETE CASCADE,
    INDEX idx_request (requestID),
    INDEX idx_provider (providerID),
    INDEX idx_customer (customerID),
    INDEX idx_rating (rating)
);

-- =====================================================
-- SERVICE COMPLETION & BUNDLES
-- =====================================================

-- ServiceCompletion Table
CREATE TABLE IF NOT EXISTS ServiceCompletion (
    completionID INT PRIMARY KEY AUTO_INCREMENT,
    requestID INT NOT NULL,
    customerConfirmation BOOLEAN DEFAULT FALSE,
    providerConfirmation BOOLEAN DEFAULT FALSE,
    completionDate DATE,
    comment TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (requestID) REFERENCES ServiceRequest(requestID) ON DELETE CASCADE,
    INDEX idx_request (requestID),
    INDEX idx_completion_date (completionDate)
);

-- ServiceBundle Table
CREATE TABLE IF NOT EXISTS ServiceBundle (
    bundleID INT PRIMARY KEY AUTO_INCREMENT,
    providerID INT NOT NULL,
    bundleName VARCHAR(200) NOT NULL,
    description TEXT,
    servicesIncluded JSON,
    price DECIMAL(10, 2) NOT NULL,
    validTill DATE,
    isActive BOOLEAN DEFAULT TRUE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (providerID) REFERENCES USER(userID) ON DELETE CASCADE,
    INDEX idx_provider (providerID),
    INDEX idx_valid_till (validTill),
    INDEX idx_is_active (isActive)
);

-- =====================================================
-- NOTIFICATION & AVAILABILITY
-- =====================================================

-- Notification Table
CREATE TABLE IF NOT EXISTS Notification (
    notificationID INT PRIMARY KEY AUTO_INCREMENT,
    userID INT NOT NULL,
    requestID INT,
    message VARCHAR(500) NOT NULL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    readStatus BOOLEAN DEFAULT FALSE,
    notificationType VARCHAR(50),
    FOREIGN KEY (userID) REFERENCES USER(userID) ON DELETE CASCADE,
    FOREIGN KEY (requestID) REFERENCES ServiceRequest(requestID) ON DELETE SET NULL,
    INDEX idx_user (userID),
    INDEX idx_read_status (readStatus),
    INDEX idx_date (date),
    INDEX idx_type (notificationType)
);

-- Availability Table
CREATE TABLE IF NOT EXISTS Availability (
    availabilityID INT PRIMARY KEY AUTO_INCREMENT,
    providerID INT NOT NULL,
    date DATE NOT NULL,
    timeSlot VARCHAR(50) NOT NULL,
    available BOOLEAN DEFAULT TRUE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (providerID) REFERENCES USER(userID) ON DELETE CASCADE,
    INDEX idx_provider (providerID),
    INDEX idx_date (date),
    INDEX idx_available (available),
    UNIQUE KEY unique_provider_slot (providerID, date, timeSlot)
);

-- =====================================================
-- COMPLAINT & CHAT
-- =====================================================

-- Complaint Table
CREATE TABLE IF NOT EXISTS Complaint (
    complaintID INT PRIMARY KEY AUTO_INCREMENT,
    reporterID INT NOT NULL,
    providerID INT NOT NULL,
    requestID INT,
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolvedAt DATETIME,
    resolutionNotes TEXT,
    FOREIGN KEY (reporterID) REFERENCES USER(userID) ON DELETE CASCADE,
    FOREIGN KEY (providerID) REFERENCES USER(userID) ON DELETE CASCADE,
    FOREIGN KEY (requestID) REFERENCES ServiceRequest(requestID) ON DELETE SET NULL,
    INDEX idx_reporter (reporterID),
    INDEX idx_provider (providerID),
    INDEX idx_status (status),
    INDEX idx_created_at (createdAt)
);

-- Chat Table
CREATE TABLE IF NOT EXISTS Chat (
    messageID INT PRIMARY KEY AUTO_INCREMENT,
    requestID INT NOT NULL,
    senderID INT NOT NULL,
    receiverID INT NOT NULL,
    messageText TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    isRead BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (requestID) REFERENCES ServiceRequest(requestID) ON DELETE CASCADE,
    FOREIGN KEY (senderID) REFERENCES USER(userID) ON DELETE CASCADE,
    FOREIGN KEY (receiverID) REFERENCES USER(userID) ON DELETE CASCADE,
    INDEX idx_request (requestID),
    INDEX idx_sender (senderID),
    INDEX idx_receiver (receiverID),
    INDEX idx_timestamp (timestamp),
    INDEX idx_read (isRead)
);

-- =====================================================
-- ANALYTICS & GAMIFICATION
-- =====================================================

-- Analytics Table (Extended for Provider Performance Analytics)
CREATE TABLE IF NOT EXISTS Analytics (
    analyticsID INT PRIMARY KEY AUTO_INCREMENT,
    providerID INT NOT NULL,
    totalEarnings DECIMAL(10, 2) DEFAULT 0.00,
    averageRating DECIMAL(3, 2) DEFAULT 0.00,
    jobsCompleted INT DEFAULT 0,
    performanceScore DECIMAL(5, 2) DEFAULT 0.00,
    responseTimeAvg DECIMAL(10, 2) DEFAULT 0,
    completionRate DECIMAL(5, 2) DEFAULT 0,
    cancellationRate DECIMAL(5, 2) DEFAULT 0,
    uniqueCustomers INT DEFAULT 0,
    repeatCustomerRate DECIMAL(5, 2) DEFAULT 0,
    monthlyRevenue JSON,
    categoryBreakdown JSON,
    lastFullUpdate DATETIME,
    lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (providerID) REFERENCES USER(userID) ON DELETE CASCADE,
    UNIQUE KEY unique_provider (providerID),
    INDEX idx_performance (performanceScore),
    INDEX idx_rating (averageRating)
);

-- Gamification Table
CREATE TABLE IF NOT EXISTS Gamification (
    gamificationID INT PRIMARY KEY AUTO_INCREMENT,
    userID INT NOT NULL,
    totalPoints INT DEFAULT 0,
    badges JSON,
    monthlyRank INT DEFAULT 0,
    currentMonthPoints INT DEFAULT 0,
    lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (userID) REFERENCES USER(userID) ON DELETE CASCADE,
    UNIQUE KEY unique_user (userID),
    INDEX idx_points (totalPoints),
    INDEX idx_rank (monthlyRank)
);

-- =====================================================
-- PROVIDER PERFORMANCE ANALYTICS TABLES
-- =====================================================

-- ProviderGoal Table (Goal Tracking)
CREATE TABLE IF NOT EXISTS ProviderGoal (
    goalID INT PRIMARY KEY AUTO_INCREMENT,
    providerID INT NOT NULL,
    goalType ENUM('revenue', 'services', 'rating', 'customers') NOT NULL,
    targetValue DECIMAL(10, 2) NOT NULL,
    currentValue DECIMAL(10, 2) DEFAULT 0,
    startDate DATE NOT NULL,
    targetDate DATE NOT NULL,
    status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (providerID) REFERENCES USER(userID) ON DELETE CASCADE,
    INDEX idx_provider (providerID),
    INDEX idx_status (status),
    INDEX idx_target_date (targetDate),
    INDEX idx_goal_type (goalType)
);

-- ScheduledReport Table (Report Scheduling)
CREATE TABLE IF NOT EXISTS ScheduledReport (
    scheduleID INT PRIMARY KEY AUTO_INCREMENT,
    providerID INT NOT NULL,
    reportType VARCHAR(50) NOT NULL,
    frequency ENUM('daily', 'weekly', 'monthly') NOT NULL,
    nextRunDate DATETIME NOT NULL,
    lastRunDate DATETIME,
    emailRecipients JSON,
    reportOptions JSON,
    isActive BOOLEAN DEFAULT TRUE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (providerID) REFERENCES USER(userID) ON DELETE CASCADE,
    INDEX idx_provider (providerID),
    INDEX idx_next_run (nextRunDate),
    INDEX idx_active (isActive),
    INDEX idx_frequency (frequency)
);

-- GeneratedReport Table (Report History)
CREATE TABLE IF NOT EXISTS GeneratedReport (
    reportID INT PRIMARY KEY AUTO_INCREMENT,
    providerID INT NOT NULL,
    reportType VARCHAR(50) NOT NULL,
    dateRangeStart DATE NOT NULL,
    dateRangeEnd DATE NOT NULL,
    filePath VARCHAR(500),
    fileFormat ENUM('pdf', 'csv', 'xlsx') NOT NULL,
    generatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    expiresAt DATETIME,
    FOREIGN KEY (providerID) REFERENCES USER(userID) ON DELETE CASCADE,
    INDEX idx_provider (providerID),
    INDEX idx_generated_at (generatedAt),
    INDEX idx_report_type (reportType),
    INDEX idx_expires_at (expiresAt)
);

-- PerformanceAlert Table (Threshold Alerts)
CREATE TABLE IF NOT EXISTS PerformanceAlert (
    alertID INT PRIMARY KEY AUTO_INCREMENT,
    providerID INT NOT NULL,
    metricType VARCHAR(50) NOT NULL,
    thresholdValue DECIMAL(10, 2) NOT NULL,
    comparisonOperator ENUM('above', 'below', 'equals') NOT NULL,
    isActive BOOLEAN DEFAULT TRUE,
    lastTriggered DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (providerID) REFERENCES USER(userID) ON DELETE CASCADE,
    INDEX idx_provider (providerID),
    INDEX idx_active (isActive),
    INDEX idx_metric_type (metricType)
);

-- PlatformBenchmark Table (Benchmarking Data)
CREATE TABLE IF NOT EXISTS PlatformBenchmark (
    benchmarkID INT PRIMARY KEY AUTO_INCREMENT,
    metricType VARCHAR(50) NOT NULL,
    category VARCHAR(100),
    averageValue DECIMAL(10, 2) NOT NULL,
    medianValue DECIMAL(10, 2),
    percentile25 DECIMAL(10, 2),
    percentile75 DECIMAL(10, 2),
    percentile90 DECIMAL(10, 2),
    sampleSize INT NOT NULL,
    calculatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_metric (metricType),
    INDEX idx_category (category),
    INDEX idx_calculated (calculatedAt)
);

-- =====================================================
-- HISTORY & MAINTENANCE
-- =====================================================

-- JobHistory Table
CREATE TABLE IF NOT EXISTS JobHistory (
    jobID INT PRIMARY KEY AUTO_INCREMENT,
    requestID INT NOT NULL,
    providerID INT NOT NULL,
    customerID INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    completionDate DATE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (requestID) REFERENCES ServiceRequest(requestID) ON DELETE CASCADE,
    FOREIGN KEY (providerID) REFERENCES USER(userID) ON DELETE CASCADE,
    FOREIGN KEY (customerID) REFERENCES USER(userID) ON DELETE CASCADE,
    INDEX idx_request (requestID),
    INDEX idx_provider (providerID),
    INDEX idx_customer (customerID),
    INDEX idx_status (status),
    INDEX idx_completion_date (completionDate)
);

-- MaintenanceReminder Table
CREATE TABLE IF NOT EXISTS MaintenanceReminder (
    reminderID INT PRIMARY KEY AUTO_INCREMENT,
    customerID INT NOT NULL,
    serviceType VARCHAR(100) NOT NULL,
    lastServiceDate DATE NOT NULL,
    nextServiceDate DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Active',
    reminderFrequency INT DEFAULT 30 COMMENT 'Days between reminders',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customerID) REFERENCES USER(userID) ON DELETE CASCADE,
    INDEX idx_customer (customerID),
    INDEX idx_next_date (nextServiceDate),
    INDEX idx_status (status)
);

-- =====================================================
-- END OF SCHEMA
-- =====================================================
