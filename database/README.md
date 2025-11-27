# Database Schema

Complete database schema for the **Local Services & Home Task Helper** project.

## Overview

This schema includes all tables for the entire system, designed for a MERN stack application using MySQL as the database.

## Setup Instructions

### Option 1: Using MySQL Workbench

1. **Open MySQL Workbench** and connect to your MySQL server

2. **Create the database:**
   ```sql
   CREATE DATABASE IF NOT EXISTS local_services_db;
   USE local_services_db;
   ```

3. **Run the schema file:**
   - Open `schema.sql` in MySQL Workbench
   - Execute the entire script (or copy-paste and run)

### Option 2: Using Command Line

1. **Create the database:**
   ```bash
   mysql -u your_username -p
   ```
   Then in MySQL:
   ```sql
   CREATE DATABASE IF NOT EXISTS local_services_db;
   ```

2. **Run the schema file:**
   ```bash
   mysql -u your_username -p local_services_db < schema.sql
   ```

## Database Structure

### Core Tables
- **USER** - Base table for all users (Customer, Provider, Admin)
- **ServiceRequest** - Service requests created by customers
- **Booking** - Scheduled bookings for services
- **Payment** - Payment transactions
- **Review** - Customer reviews and provider replies

### Service Management
- **ServiceCompletion** - Completion confirmation system
- **ServiceBundle** - Provider service packages
- **Availability** - Provider availability calendar

### Communication & Support
- **Notification** - System notifications
- **Chat** - In-app messaging
- **Complaint** - Complaint management system

### Analytics & Engagement
- **Analytics** - Provider performance metrics
- **Gamification** - Points, badges, and rankings
- **JobHistory** - Historical job records
- **MaintenanceReminder** - Service maintenance reminders

## Important Notes

1. **Foreign Key Dependencies**: All tables are properly linked with foreign key constraints
2. **Indexes**: Performance indexes are added for frequently queried columns
3. **Timestamps**: Most tables include `createdAt` and `updatedAt` for tracking
4. **Data Types**: 
   - Use `DECIMAL` for monetary values
   - Use `JSON` for flexible data structures (badges, servicesIncluded)
   - Use `ENUM` for fixed value sets (role)

## Team Collaboration

- **Share this schema** with all team members via GitHub
- **Coordinate** on table modifications to avoid conflicts
- **Test locally** before pushing changes
- **Document** any custom modifications you make

## Environment Variables

Create a `.env` file in your backend directory:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=local_services_db
PORT=5000
```

## Troubleshooting

- **Foreign Key Errors**: Make sure USER table is created first
- **Duplicate Key Errors**: Check for existing data before running schema
- **Connection Issues**: Verify MySQL service is running and credentials are correct

## Next Steps

After setting up the database:
1. Configure backend connection (see `backend/config/database.js`)
2. Create models for each table
3. Implement controllers and routes
4. Test database operations
