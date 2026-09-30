import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AdminRoute from './components/AdminRoute';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminRepaymentsPage from './pages/admin/AdminRepaymentsPage';
import AuditLogsPage from './pages/admin/AuditLogsPage';
import ConfigurationOverviewPage from './pages/admin/configuration/ConfigurationOverviewPage';
import LoanProductsPage from './pages/admin/configuration/LoanProductsPage';
import OrganizationSettingsPage from './pages/admin/configuration/OrganizationSettingsPage';
import PartnersPage from './pages/admin/configuration/PartnersPage';
import ProductWizardPage from './pages/admin/configuration/ProductWizardPage';
import ProvidersPage from './pages/admin/configuration/ProvidersPage';
import LoanApplicationsPage from './pages/admin/LoanApplicationsPage';
import LoanReviewDetailsPage from './pages/admin/LoanReviewDetailsPage';
import UserDetailsPage from './pages/admin/UserDetailsPage';
import UsersListPage from './pages/admin/UsersListPage';
import LandingPage from './pages/public/LandingPage';
import LoginPage from './pages/public/LoginPage';
import EmiCalculatorPage from './pages/user/EmiCalculatorPage';
import NotificationsPage from './pages/user/NotificationsPage';
import ProfilePage from './pages/user/ProfilePage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Navigate to="/admin" replace />} />
          <Route path="/calculator" element={<EmiCalculatorPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/masters" element={<Navigate to="/admin/configuration" replace />} />
            <Route path="/admin/configuration" element={<ConfigurationOverviewPage />} />
            <Route path="/admin/configuration/products" element={<LoanProductsPage />} />
            <Route path="/admin/configuration/products/new" element={<ProductWizardPage />} />
            <Route path="/admin/configuration/organization" element={<OrganizationSettingsPage />} />
            <Route path="/admin/configuration/partners" element={<PartnersPage />} />
            <Route path="/admin/configuration/providers" element={<ProvidersPage />} />
            <Route path="/admin/users" element={<UsersListPage />} />
            <Route path="/admin/staff-users" element={<UsersListPage />} />
            <Route path="/admin/users/:id" element={<UserDetailsPage />} />
            <Route path="/admin/applications" element={<LoanApplicationsPage />} />
            <Route path="/admin/applications/:id" element={<LoanReviewDetailsPage />} />
            <Route path="/admin/repayments" element={<AdminRepaymentsPage />} />
            <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
