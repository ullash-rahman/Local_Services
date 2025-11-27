#!/bin/bash

# Database Setup Script
# Run this script to set up the database locally

echo "=========================================="
echo "Local Services Database Setup"
echo "=========================================="
echo ""

# Check if MySQL is installed
if ! command -v mysql &> /dev/null; then
    echo "Error: MySQL is not installed or not in PATH"
    exit 1
fi

# Prompt for database credentials
read -p "Enter MySQL username (default: root): " DB_USER
DB_USER=${DB_USER:-root}

read -sp "Enter MySQL password: " DB_PASSWORD
echo ""

read -p "Enter database name (default: local_services_db): " DB_NAME
DB_NAME=${DB_NAME:-local_services_db}

echo ""
echo "Creating database: $DB_NAME"
mysql -u "$DB_USER" -p"$DB_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME;" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✓ Database created successfully"
else
    echo "✗ Error creating database. Please check your credentials."
    exit 1
fi

echo ""
echo "Running schema.sql..."
mysql -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < schema.sql

if [ $? -eq 0 ]; then
    echo "✓ Schema loaded successfully"
    echo ""
    echo "=========================================="
    echo "Database setup complete!"
    echo "=========================================="
    echo "Database: $DB_NAME"
    echo "You can now use this database in your application."
else
    echo "✗ Error loading schema. Please check the schema.sql file."
    exit 1
fi

