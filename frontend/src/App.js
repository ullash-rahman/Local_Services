import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import CustomerDashboard from './components/Dashboard/CustomerDashboard';
import ProviderDashboard from './components/Dashboard/ProviderDashboard';
import { authService } from './services/authService';
import BundleManagerPage from './components/Bundle/BundleManagerPage';
import BundleListPage from './components/Bundle/BundleListPage';
import Gamification from './components/Gamification/Gamification';
import AnalyticsDashboard from './components/Analytics/AnalyticsDashboard';
import ProviderManualBookingsPage from './components/Booking/ProviderManualBookingsPage';
import ManualBookingPage from './components/Booking/ManualBookingPage';
import ProviderAvailabilityCalendarPage from './components/Booking/ProviderAvailabilityCalendarPage';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
    const isAuthenticated = authService.isAuthenticated();
    const user = authService.getCurrentUser();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user?.role)) {
        return <Navigate to="/login" replace />;
    }

    return children;
};

function App() {
    return (
        <Router>
            <div className="App">
                <Routes>
                    {/* Public Routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    
                    {/* Protected Routes */}
                    <Route
                        path="/dashboard/customer"
                        element={
                            <ProtectedRoute allowedRoles={['Customer']}>
                                <CustomerDashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/provider"
                        element={
                            <ProtectedRoute allowedRoles={['Provider']}>
                                <ProviderDashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/provider/servicebundle"
                        element={
                            <ProtectedRoute allowedRoles={['Provider']}>
                                <BundleManagerPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/customer/bundles"
                        element={
                            <ProtectedRoute allowedRoles={['Customer']}>
                                <BundleListPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/customer/manual-bookings"
                        element={
                            <ProtectedRoute allowedRoles={['Customer']}>
                                <ManualBookingPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/gamification"
                        element={
                            <ProtectedRoute>
                                <Gamification />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/provider/analytics"
                        element={
                            <ProtectedRoute allowedRoles={['Provider']}>
                                <AnalyticsDashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/provider/manual-bookings"
                        element={
                            <ProtectedRoute allowedRoles={['Provider']}>
                                <ProviderManualBookingsPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard/provider/availability"
                        element={
                            <ProtectedRoute allowedRoles={['Provider']}>
                                <ProviderAvailabilityCalendarPage />
                            </ProtectedRoute>
                        }
                    />
                    {/* Redirect old routes to analytics */}
                    <Route
                        path="/dashboard/provider/reports"
                        element={<Navigate to="/dashboard/provider/analytics" replace />}
                    />
                    <Route
                        path="/dashboard/provider/goals"
                        element={<Navigate to="/dashboard/provider/analytics" replace />}
                    />
                    {/* Default redirect */}
                    <Route path="/" element={<Navigate to="/login" replace />} />
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;

