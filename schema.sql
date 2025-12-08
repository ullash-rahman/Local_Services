-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Dec 07, 2025 at 06:55 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `local_services_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `analytics`
--

CREATE TABLE `analytics` (
  `analyticsID` int(11) NOT NULL,
  `providerID` int(11) NOT NULL,
  `totalEarnings` decimal(10,2) DEFAULT 0.00,
  `averageRating` decimal(3,2) DEFAULT 0.00,
  `jobsCompleted` int(11) DEFAULT 0,
  `performanceScore` decimal(5,2) DEFAULT 0.00,
  `lastUpdated` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `availability`
--

CREATE TABLE `availability` (
  `availabilityID` int(11) NOT NULL,
  `providerID` int(11) NOT NULL,
  `date` date NOT NULL,
  `timeSlot` varchar(50) NOT NULL,
  `available` tinyint(1) DEFAULT 1,
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `booking`
--

CREATE TABLE `booking` (
  `bookingID` int(11) NOT NULL,
  `requestID` int(11) NOT NULL,
  `providerID` int(11) NOT NULL,
  `scheduledDate` date NOT NULL,
  `scheduledTime` time DEFAULT NULL,
  `manualBooking` tinyint(1) DEFAULT 0,
  `cancellationReason` text DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `chat`
--

CREATE TABLE `chat` (
  `messageID` int(11) NOT NULL,
  `requestID` int(11) NOT NULL,
  `senderID` int(11) NOT NULL,
  `receiverID` int(11) NOT NULL,
  `messageText` text NOT NULL,
  `timestamp` datetime DEFAULT current_timestamp(),
  `isRead` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `complaint`
--

CREATE TABLE `complaint` (
  `complaintID` int(11) NOT NULL,
  `reporterID` int(11) NOT NULL,
  `providerID` int(11) NOT NULL,
  `requestID` int(11) DEFAULT NULL,
  `description` text NOT NULL,
  `status` varchar(50) DEFAULT 'Pending',
  `createdAt` datetime DEFAULT current_timestamp(),
  `resolvedAt` datetime DEFAULT NULL,
  `resolutionNotes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `gamification`
--

CREATE TABLE `gamification` (
  `gamificationID` int(11) NOT NULL,
  `userID` int(11) NOT NULL,
  `totalPoints` int(11) DEFAULT 0,
  `monthlyPoints` int(11) DEFAULT 0,
  `badgesEarned` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT '[]' CHECK (json_valid(`badgesEarned`)),
  `consecutiveDays` int(11) DEFAULT 1,
  `lastJobDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `monthlyResetDate` timestamp NOT NULL DEFAULT current_timestamp(),
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `gamification_badges`
--

CREATE TABLE `gamification_badges` (
  `badgeID` int(11) NOT NULL,
  `badgeName` varchar(100) NOT NULL,
  `badgeCode` varchar(50) NOT NULL,
  `pointsRequired` int(11) NOT NULL,
  `description` text DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `gamification_badges`
--

INSERT INTO `gamification_badges` (`badgeID`, `badgeName`, `badgeCode`, `pointsRequired`, `description`, `createdAt`) VALUES
(1, 'Centaurion', 'centaurion', 100, 'Earned 100 points', '2025-12-07 17:43:40'),
(2, 'Elite Worker', 'elite_worker', 500, 'Earned 500 points', '2025-12-07 17:43:40'),
(3, 'Master Provider', 'master_provider', 1000, 'Earned 1000 points', '2025-12-07 17:43:40'),
(4, 'Week Warrior', 'week_warrior', 7, '7 consecutive days', '2025-12-07 17:43:40'),
(5, 'Month Master', 'month_master', 30, '30 consecutive days', '2025-12-07 17:43:40');

-- --------------------------------------------------------

--
-- Table structure for table `gamification_history`
--

CREATE TABLE `gamification_history` (
  `historyID` int(11) NOT NULL,
  `userID` int(11) NOT NULL,
  `action` varchar(50) DEFAULT NULL,
  `pointsEarned` int(11) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `jobID` int(11) DEFAULT NULL,
  `rating` decimal(2,1) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `jobhistory`
--

CREATE TABLE `jobhistory` (
  `jobID` int(11) NOT NULL,
  `requestID` int(11) NOT NULL,
  `providerID` int(11) NOT NULL,
  `customerID` int(11) NOT NULL,
  `status` varchar(50) NOT NULL,
  `completionDate` date DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `maintenancereminder`
--

CREATE TABLE `maintenancereminder` (
  `reminderID` int(11) NOT NULL,
  `customerID` int(11) NOT NULL,
  `serviceType` varchar(100) NOT NULL,
  `lastServiceDate` date NOT NULL,
  `nextServiceDate` date NOT NULL,
  `status` varchar(50) DEFAULT 'Active',
  `reminderFrequency` int(11) DEFAULT 30 COMMENT 'Days between reminders',
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notification`
--

CREATE TABLE `notification` (
  `notificationID` int(11) NOT NULL,
  `userID` int(11) NOT NULL,
  `requestID` int(11) DEFAULT NULL,
  `message` varchar(500) NOT NULL,
  `date` datetime DEFAULT current_timestamp(),
  `readStatus` tinyint(1) DEFAULT 0,
  `notificationType` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payment`
--

CREATE TABLE `payment` (
  `paymentID` int(11) NOT NULL,
  `requestID` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `status` varchar(50) DEFAULT 'Pending',
  `paymentDate` datetime DEFAULT NULL,
  `paymentMethod` varchar(50) DEFAULT NULL,
  `transactionID` varchar(100) DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `review`
--

CREATE TABLE `review` (
  `reviewID` int(11) NOT NULL,
  `requestID` int(11) NOT NULL,
  `customerID` int(11) NOT NULL,
  `providerID` int(11) NOT NULL,
  `rating` int(11) NOT NULL CHECK (`rating` >= 1 and `rating` <= 5),
  `comment` text DEFAULT NULL,
  `reply` text DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `servicebundle`
--

CREATE TABLE `servicebundle` (
  `bundleID` int(11) NOT NULL,
  `providerID` int(11) NOT NULL,
  `bundleName` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `servicesIncluded` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`servicesIncluded`)),
  `price` decimal(10,2) NOT NULL,
  `validTill` date DEFAULT NULL,
  `isActive` tinyint(1) DEFAULT 1,
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `servicecompletion`
--

CREATE TABLE `servicecompletion` (
  `completionID` int(11) NOT NULL,
  `requestID` int(11) NOT NULL,
  `customerConfirmation` tinyint(1) DEFAULT 0,
  `providerConfirmation` tinyint(1) DEFAULT 0,
  `completionDate` date DEFAULT NULL,
  `comment` text DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `servicerequest`
--

CREATE TABLE `servicerequest` (
  `requestID` int(11) NOT NULL,
  `customerID` int(11) NOT NULL,
  `providerID` int(11) DEFAULT NULL,
  `category` varchar(100) NOT NULL,
  `description` text NOT NULL,
  `requestDate` datetime DEFAULT current_timestamp(),
  `serviceDate` datetime DEFAULT NULL,
  `status` varchar(50) DEFAULT 'Pending',
  `priorityLevel` varchar(50) DEFAULT 'Normal',
  `completionConfirmed` tinyint(1) DEFAULT 0,
  `cancellationReason` text DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user`
--

CREATE TABLE `user` (
  `userID` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `role` enum('Customer','Provider','Admin') NOT NULL,
  `verified` tinyint(1) DEFAULT 0,
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `analytics`
--
ALTER TABLE `analytics`
  ADD PRIMARY KEY (`analyticsID`),
  ADD UNIQUE KEY `unique_provider` (`providerID`),
  ADD KEY `idx_performance` (`performanceScore`),
  ADD KEY `idx_rating` (`averageRating`);

--
-- Indexes for table `availability`
--
ALTER TABLE `availability`
  ADD PRIMARY KEY (`availabilityID`),
  ADD UNIQUE KEY `unique_provider_slot` (`providerID`,`date`,`timeSlot`),
  ADD KEY `idx_provider` (`providerID`),
  ADD KEY `idx_date` (`date`),
  ADD KEY `idx_available` (`available`);

--
-- Indexes for table `booking`
--
ALTER TABLE `booking`
  ADD PRIMARY KEY (`bookingID`),
  ADD KEY `idx_request` (`requestID`),
  ADD KEY `idx_provider` (`providerID`),
  ADD KEY `idx_scheduled_date` (`scheduledDate`);

--
-- Indexes for table `chat`
--
ALTER TABLE `chat`
  ADD PRIMARY KEY (`messageID`),
  ADD KEY `idx_request` (`requestID`),
  ADD KEY `idx_sender` (`senderID`),
  ADD KEY `idx_receiver` (`receiverID`),
  ADD KEY `idx_timestamp` (`timestamp`),
  ADD KEY `idx_read` (`isRead`);

--
-- Indexes for table `complaint`
--
ALTER TABLE `complaint`
  ADD PRIMARY KEY (`complaintID`),
  ADD KEY `requestID` (`requestID`),
  ADD KEY `idx_reporter` (`reporterID`),
  ADD KEY `idx_provider` (`providerID`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_created_at` (`createdAt`);

--
-- Indexes for table `gamification`
--
ALTER TABLE `gamification`
  ADD PRIMARY KEY (`gamificationID`),
  ADD UNIQUE KEY `userID` (`userID`),
  ADD KEY `idx_user_id` (`userID`),
  ADD KEY `idx_total_points` (`totalPoints`),
  ADD KEY `idx_monthly_points` (`monthlyPoints`);

--
-- Indexes for table `gamification_badges`
--
ALTER TABLE `gamification_badges`
  ADD PRIMARY KEY (`badgeID`),
  ADD UNIQUE KEY `badgeName` (`badgeName`),
  ADD UNIQUE KEY `badgeCode` (`badgeCode`);

--
-- Indexes for table `gamification_history`
--
ALTER TABLE `gamification_history`
  ADD PRIMARY KEY (`historyID`),
  ADD KEY `idx_user_id` (`userID`),
  ADD KEY `idx_action` (`action`),
  ADD KEY `idx_created_at` (`createdAt`);

--
-- Indexes for table `jobhistory`
--
ALTER TABLE `jobhistory`
  ADD PRIMARY KEY (`jobID`),
  ADD KEY `idx_request` (`requestID`),
  ADD KEY `idx_provider` (`providerID`),
  ADD KEY `idx_customer` (`customerID`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_completion_date` (`completionDate`);

--
-- Indexes for table `maintenancereminder`
--
ALTER TABLE `maintenancereminder`
  ADD PRIMARY KEY (`reminderID`),
  ADD KEY `idx_customer` (`customerID`),
  ADD KEY `idx_next_date` (`nextServiceDate`),
  ADD KEY `idx_status` (`status`);

--
-- Indexes for table `notification`
--
ALTER TABLE `notification`
  ADD PRIMARY KEY (`notificationID`),
  ADD KEY `requestID` (`requestID`),
  ADD KEY `idx_user` (`userID`),
  ADD KEY `idx_read_status` (`readStatus`),
  ADD KEY `idx_date` (`date`),
  ADD KEY `idx_type` (`notificationType`);

--
-- Indexes for table `payment`
--
ALTER TABLE `payment`
  ADD PRIMARY KEY (`paymentID`),
  ADD KEY `idx_request` (`requestID`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_payment_date` (`paymentDate`);

--
-- Indexes for table `review`
--
ALTER TABLE `review`
  ADD PRIMARY KEY (`reviewID`),
  ADD KEY `idx_request` (`requestID`),
  ADD KEY `idx_provider` (`providerID`),
  ADD KEY `idx_customer` (`customerID`),
  ADD KEY `idx_rating` (`rating`);

--
-- Indexes for table `servicebundle`
--
ALTER TABLE `servicebundle`
  ADD PRIMARY KEY (`bundleID`),
  ADD KEY `idx_provider` (`providerID`),
  ADD KEY `idx_valid_till` (`validTill`),
  ADD KEY `idx_is_active` (`isActive`);

--
-- Indexes for table `servicecompletion`
--
ALTER TABLE `servicecompletion`
  ADD PRIMARY KEY (`completionID`),
  ADD KEY `idx_request` (`requestID`),
  ADD KEY `idx_completion_date` (`completionDate`);

--
-- Indexes for table `servicerequest`
--
ALTER TABLE `servicerequest`
  ADD PRIMARY KEY (`requestID`),
  ADD KEY `idx_customer` (`customerID`),
  ADD KEY `idx_provider` (`providerID`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_category` (`category`),
  ADD KEY `idx_service_date` (`serviceDate`);

--
-- Indexes for table `user`
--
ALTER TABLE `user`
  ADD PRIMARY KEY (`userID`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_role` (`role`),
  ADD KEY `idx_verified` (`verified`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `analytics`
--
ALTER TABLE `analytics`
  MODIFY `analyticsID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `availability`
--
ALTER TABLE `availability`
  MODIFY `availabilityID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `booking`
--
ALTER TABLE `booking`
  MODIFY `bookingID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `chat`
--
ALTER TABLE `chat`
  MODIFY `messageID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `complaint`
--
ALTER TABLE `complaint`
  MODIFY `complaintID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `gamification`
--
ALTER TABLE `gamification`
  MODIFY `gamificationID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `gamification_badges`
--
ALTER TABLE `gamification_badges`
  MODIFY `badgeID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `gamification_history`
--
ALTER TABLE `gamification_history`
  MODIFY `historyID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `jobhistory`
--
ALTER TABLE `jobhistory`
  MODIFY `jobID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `maintenancereminder`
--
ALTER TABLE `maintenancereminder`
  MODIFY `reminderID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notification`
--
ALTER TABLE `notification`
  MODIFY `notificationID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payment`
--
ALTER TABLE `payment`
  MODIFY `paymentID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `review`
--
ALTER TABLE `review`
  MODIFY `reviewID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `servicebundle`
--
ALTER TABLE `servicebundle`
  MODIFY `bundleID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `servicecompletion`
--
ALTER TABLE `servicecompletion`
  MODIFY `completionID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `servicerequest`
--
ALTER TABLE `servicerequest`
  MODIFY `requestID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user`
--
ALTER TABLE `user`
  MODIFY `userID` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `analytics`
--
ALTER TABLE `analytics`
  ADD CONSTRAINT `analytics_ibfk_1` FOREIGN KEY (`providerID`) REFERENCES `user` (`userID`) ON DELETE CASCADE;

--
-- Constraints for table `availability`
--
ALTER TABLE `availability`
  ADD CONSTRAINT `availability_ibfk_1` FOREIGN KEY (`providerID`) REFERENCES `user` (`userID`) ON DELETE CASCADE;

--
-- Constraints for table `booking`
--
ALTER TABLE `booking`
  ADD CONSTRAINT `booking_ibfk_1` FOREIGN KEY (`requestID`) REFERENCES `servicerequest` (`requestID`) ON DELETE CASCADE,
  ADD CONSTRAINT `booking_ibfk_2` FOREIGN KEY (`providerID`) REFERENCES `user` (`userID`) ON DELETE CASCADE;

--
-- Constraints for table `chat`
--
ALTER TABLE `chat`
  ADD CONSTRAINT `chat_ibfk_1` FOREIGN KEY (`requestID`) REFERENCES `servicerequest` (`requestID`) ON DELETE CASCADE,
  ADD CONSTRAINT `chat_ibfk_2` FOREIGN KEY (`senderID`) REFERENCES `user` (`userID`) ON DELETE CASCADE,
  ADD CONSTRAINT `chat_ibfk_3` FOREIGN KEY (`receiverID`) REFERENCES `user` (`userID`) ON DELETE CASCADE;

--
-- Constraints for table `complaint`
--
ALTER TABLE `complaint`
  ADD CONSTRAINT `complaint_ibfk_1` FOREIGN KEY (`reporterID`) REFERENCES `user` (`userID`) ON DELETE CASCADE,
  ADD CONSTRAINT `complaint_ibfk_2` FOREIGN KEY (`providerID`) REFERENCES `user` (`userID`) ON DELETE CASCADE,
  ADD CONSTRAINT `complaint_ibfk_3` FOREIGN KEY (`requestID`) REFERENCES `servicerequest` (`requestID`) ON DELETE SET NULL;

--
-- Constraints for table `gamification`
--
ALTER TABLE `gamification`
  ADD CONSTRAINT `gamification_ibfk_1` FOREIGN KEY (`userID`) REFERENCES `user` (`userID`) ON DELETE CASCADE;

--
-- Constraints for table `gamification_history`
--
ALTER TABLE `gamification_history`
  ADD CONSTRAINT `gamification_history_ibfk_1` FOREIGN KEY (`userID`) REFERENCES `user` (`userID`) ON DELETE CASCADE;

--
-- Constraints for table `jobhistory`
--
ALTER TABLE `jobhistory`
  ADD CONSTRAINT `jobhistory_ibfk_1` FOREIGN KEY (`requestID`) REFERENCES `servicerequest` (`requestID`) ON DELETE CASCADE,
  ADD CONSTRAINT `jobhistory_ibfk_2` FOREIGN KEY (`providerID`) REFERENCES `user` (`userID`) ON DELETE CASCADE,
  ADD CONSTRAINT `jobhistory_ibfk_3` FOREIGN KEY (`customerID`) REFERENCES `user` (`userID`) ON DELETE CASCADE;

--
-- Constraints for table `maintenancereminder`
--
ALTER TABLE `maintenancereminder`
  ADD CONSTRAINT `maintenancereminder_ibfk_1` FOREIGN KEY (`customerID`) REFERENCES `user` (`userID`) ON DELETE CASCADE;

--
-- Constraints for table `notification`
--
ALTER TABLE `notification`
  ADD CONSTRAINT `notification_ibfk_1` FOREIGN KEY (`userID`) REFERENCES `user` (`userID`) ON DELETE CASCADE,
  ADD CONSTRAINT `notification_ibfk_2` FOREIGN KEY (`requestID`) REFERENCES `servicerequest` (`requestID`) ON DELETE SET NULL;

--
-- Constraints for table `payment`
--
ALTER TABLE `payment`
  ADD CONSTRAINT `payment_ibfk_1` FOREIGN KEY (`requestID`) REFERENCES `servicerequest` (`requestID`) ON DELETE CASCADE;

--
-- Constraints for table `review`
--
ALTER TABLE `review`
  ADD CONSTRAINT `review_ibfk_1` FOREIGN KEY (`requestID`) REFERENCES `servicerequest` (`requestID`) ON DELETE CASCADE,
  ADD CONSTRAINT `review_ibfk_2` FOREIGN KEY (`customerID`) REFERENCES `user` (`userID`) ON DELETE CASCADE,
  ADD CONSTRAINT `review_ibfk_3` FOREIGN KEY (`providerID`) REFERENCES `user` (`userID`) ON DELETE CASCADE;

--
-- Constraints for table `servicebundle`
--
ALTER TABLE `servicebundle`
  ADD CONSTRAINT `servicebundle_ibfk_1` FOREIGN KEY (`providerID`) REFERENCES `user` (`userID`) ON DELETE CASCADE;

--
-- Constraints for table `servicecompletion`
--
ALTER TABLE `servicecompletion`
  ADD CONSTRAINT `servicecompletion_ibfk_1` FOREIGN KEY (`requestID`) REFERENCES `servicerequest` (`requestID`) ON DELETE CASCADE;

--
-- Constraints for table `servicerequest`
--
ALTER TABLE `servicerequest`
  ADD CONSTRAINT `servicerequest_ibfk_1` FOREIGN KEY (`customerID`) REFERENCES `user` (`userID`) ON DELETE CASCADE,
  ADD CONSTRAINT `servicerequest_ibfk_2` FOREIGN KEY (`providerID`) REFERENCES `user` (`userID`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
