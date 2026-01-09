#!/bin/bash

# Database Migration Runner
# This script runs the payment due date migration

echo "Starting Payment Due Date Migration..."

# Load environment variables if .env file exists
if [ -f "../backend/.env" ]; then
    export $(cat ../backend/.env | grep -v '#' | awk '/=/ {print $1}')
fi

# Set default values if not provided
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-3306}
DB_USER=${DB_USER:-root}
DB_NAME=${DB_NAME:-local_services_db}

echo "Connecting to database: $DB_NAME on $DB_HOST:$DB_PORT"

# Run the migration
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p "$DB_NAME" < migrations/add_payment_due_date.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo "✅ dueDate column added to Payment table"
    echo "✅ Performance indexes created"
    echo "✅ Existing payments updated with default due dates"
else
    echo "❌ Migration failed!"
    exit 1
fi

echo "Migration completed at $(date)"