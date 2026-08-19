import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ConfirmDialogProvider } from './context/ConfirmContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleGuard from './components/RoleGuard';
import AppLayout from './components/layout/AppLayout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import FollowUpDetails from './pages/FollowUpDetails';
import Customers from './pages/Customers';
import CustomerDetails from './pages/CustomerDetails';
import Orders from './pages/Orders';
import Products from './pages/Products';
import FollowUps from './pages/FollowUps';
import Reminders from './pages/Reminders';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Settings from './pages/Settings';

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ConfirmDialogProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Route */}
              <Route path="/login" element={<Login />} />

              {/* Protected Workspace Layout */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                
                <Route
                  path="/dashboard"
                  element={
                    <RoleGuard module="dashboard">
                      <Dashboard />
                    </RoleGuard>
                  }
                />

                <Route
                  path="/leads"
                  element={
                    <RoleGuard module="leads">
                      <Leads />
                    </RoleGuard>
                  }
                />

                <Route
                  path="/leads/:id/followup"
                  element={
                    <RoleGuard module="leads">
                      <FollowUpDetails />
                    </RoleGuard>
                  }
                />

                <Route
                  path="/customers"
                  element={
                    <RoleGuard module="customers">
                      <Customers />
                    </RoleGuard>
                  }
                />

                <Route
                  path="/customers/:id"
                  element={
                    <RoleGuard module="customers">
                      <CustomerDetails />
                    </RoleGuard>
                  }
                />

                <Route
                  path="/orders"
                  element={
                    <RoleGuard module="orders">
                      <Orders />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/products"
                  element={
                    <RoleGuard module="products">
                      <Products />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/followups"
                  element={
                    <RoleGuard module="followups">
                      <FollowUps />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/reminders"
                  element={
                    <RoleGuard module="reminders">
                      <Reminders />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <RoleGuard module="reports">
                      <Reports />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <RoleGuard module="users">
                      <Users />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <RoleGuard module="settings">
                      <Settings />
                    </RoleGuard>
                  }
                />
              </Route>

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </ConfirmDialogProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
