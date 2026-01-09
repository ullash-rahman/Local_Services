# Local Services Platform

A comprehensive local services platform connecting customers with service providers, featuring real-time communication, payment processing, job history tracking, and maintenance reminders.

## 🚀 Features

### Core Features
- **User Management**: Customer, Provider, and Admin roles
- **Service Requests**: Create, manage, and track service requests
- **Real-time Chat**: Socket.io powered messaging between customers and providers
- **Payment System**: Complete payment processing with due date tracking
- **Job History**: Comprehensive tracking of completed services
- **Maintenance Reminders**: Automated reminders for recurring services
- **Gamification**: Points and badges system for providers
- **Analytics Dashboard**: Provider performance analytics and reporting
- **Manual Bookings**: Direct booking system for providers
- **Availability Management**: Provider schedule management

### Recent Updates (Final Branch Integration)
- ✅ Enhanced payment system with due date tracking
- ✅ Job history tracking for customers and providers
- ✅ Maintenance reminder system
- ✅ Improved analytics and gamification
- ✅ Real-time payment status notifications
- ✅ Enhanced service request management

## 🛠 Technology Stack

### Backend
- **Node.js** with Express.js
- **MySQL** database
- **Socket.io** for real-time communication
- **JWT** authentication
- **Multer** for file uploads

### Frontend
- **React.js** with React Router
- **Socket.io-client** for real-time features
- **CSS3** for styling
- **Axios** for API communication

## 📋 Prerequisites

- Node.js (v14 or higher)
- MySQL (v8.0 or higher)
- npm or yarn package manager

## 🔧 Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd Local_Services
```

### 2. Database Setup
```bash
# Navigate to database directory
cd database

# Create the database using MySQL client
mysql -u root -p < schema.sql

# Run migration to add recent updates (Windows)
run_migration.bat

# Or run migration manually
mysql -u root -p local_services_db < migrations/add_payment_due_date.sql

# Verify database synchronization
mysql -u root -p local_services_db < verify_sync.sql
```

### 3. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Update .env with your database credentials
# DB_HOST=localhost
# DB_PORT=3306
# DB_USER=root
# DB_PASSWORD=your_password
# DB_NAME=local_services_db
# JWT_SECRET=your_jwt_secret
# PORT=5000

# Start the backend server
npm start
```

### 4. Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create environment file (optional)
# REACT_APP_API_URL=http://localhost:5000/api

# Start the frontend development server
npm start
```

## 🗄 Database Schema

### Core Tables
- **USER**: Customer, Provider, and Admin accounts
- **ServiceRequest**: Service requests with priority levels
- **Payment**: Payment records with due date tracking
- **JobHistory**: Completed service history
- **MaintenanceReminder**: Recurring service reminders
- **Gamification**: Points and badges system
- **Analytics**: Provider performance metrics

### Recent Schema Updates
- Added `dueDate` column to Payment table
- Enhanced indexes for better query performance
- Standardized table naming conventions

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Service Requests
- `GET /api/service-requests` - Get service requests
- `POST /api/service-requests` - Create service request
- `PUT /api/service-requests/:id` - Update service request

### Payments
- `GET /api/payments/customer/:id` - Get customer payments
- `GET /api/payments/provider/:id` - Get provider payments
- `PUT /api/payments/:id/mark-paid` - Mark payment as paid
- `GET /api/payments/summary/:id` - Get payment summary

### History & Maintenance
- `GET /api/history` - Get job history
- `GET /api/maintenance` - Get maintenance reminders
- `POST /api/maintenance` - Create maintenance reminder

## 🎮 Gamification System

### Points System
- **Payment Points**: 15 base + min(floor(amount/100), 50) bonus
- **Review Reply**: 5 points for responding to reviews
- **Earnings Milestones**: Badges at 1K, 5K, 10K BDT

### Badges
- **Centaurion**: 100+ points
- **Elite Worker**: 500+ points
- **Master Provider**: 1000+ points
- **Week Warrior**: 7 consecutive days
- **Month Master**: 30 consecutive days

## 🔄 Real-time Features

### Socket.io Events
- **Chat Messages**: Real-time messaging
- **Payment Updates**: Payment status notifications
- **Rank Changes**: Gamification rank updates
- **Badge Earned**: New badge notifications

## 🚀 Deployment

### Production Environment Variables
```env
NODE_ENV=production
DB_HOST=your_production_db_host
DB_USER=your_production_db_user
DB_PASSWORD=your_production_db_password
JWT_SECRET=your_strong_jwt_secret
FRONTEND_URL=https://your-frontend-domain.com
```

### Build Commands
```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
```

## 🧪 Testing

### Run Backend Tests
```bash
cd backend
npm test
```

### Run Frontend Tests
```bash
cd frontend
npm test
```

## 📊 Database Synchronization Status

✅ **Database Schema**: All tables properly created and indexed
✅ **Backend Models**: All models synchronized with database structure
✅ **Frontend Services**: API calls match backend endpoints
✅ **Real-time Features**: Socket.io properly configured
✅ **Payment System**: Due date tracking fully implemented
✅ **Migration Scripts**: Available for database updates

## 🔧 Recent Fixes Applied

1. **Payment Model Synchronization**
   - Added `dueDate` column to Payment table
   - Updated all Payment model methods to handle due dates
   - Fixed overdue payment detection logic

2. **ServiceRequest Model Updates**
   - Updated all queries to include payment due dates
   - Improved query performance with additional indexes

3. **Gamification Standardization**
   - Standardized table name usage
   - Removed dynamic table name detection complexity

4. **Performance Improvements**
   - Added composite indexes for frequently queried fields
   - Optimized payment and service request queries

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and verify synchronization
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 📞 Support

For support and questions, please contact the development team or create an issue in the repository.

---

**Last Updated**: January 2025
**Version**: 2.0.0 (Final Branch Integration)