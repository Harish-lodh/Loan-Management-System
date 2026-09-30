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
import CustomerDetailsPage from './pages/admin/CustomerDetailsPage';
import CustomersPage from './pages/admin/CustomersPage';
import LoanApplicationsPage from './pages/admin/LoanApplicationsPage';
import LoanReviewDetailsPage from './pages/admin/LoanReviewDetailsPage';
import NewApplicationPage from './pages/admin/NewApplicationPage';
import StaffUsersPage from './pages/admin/StaffUsersPage';
import LoginPage from './pages/public/LoginPage';
import EmiCalculatorPage from './pages/user/EmiCalculatorPage';
import NotificationsPage from './pages/user/NotificationsPage';
import ProfilePage from './pages/user/ProfilePage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Navigate to="/admin" replace />} />
          <Route path="/calculator" element={<EmiCalculatorPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          <Route element={<AdminRoute permission="dashboard.view" />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>

          <Route element={<AdminRoute permission="customer.view" />}>
            <Route path="/admin/customers" element={<CustomersPage />} />
            <Route path="/admin/customers/:id" element={<CustomerDetailsPage />} />
          </Route>
          {/* Old links from before customers were split out of users. */}
          <Route path="/admin/users" element={<Navigate to="/admin/customers" replace />} />

          <Route element={<AdminRoute permission="application.view" />}>
            <Route path="/admin/applications" element={<LoanApplicationsPage />} />
            <Route path="/admin/applications/:id" element={<LoanReviewDetailsPage />} />
          </Route>
          <Route element={<AdminRoute permission="application.create" />}>
            <Route path="/admin/applications/new" element={<NewApplicationPage />} />
          </Route>

          <Route element={<AdminRoute permission="repayment.view" />}>
            <Route path="/admin/repayments" element={<AdminRepaymentsPage />} />
          </Route>

          <Route element={<AdminRoute permission="product.view" />}>
            <Route path="/admin/masters" element={<Navigate to="/admin/configuration" replace />} />
            <Route path="/admin/configuration" element={<ConfigurationOverviewPage />} />
            <Route path="/admin/configuration/products" element={<LoanProductsPage />} />
            <Route path="/admin/configuration/partners" element={<PartnersPage />} />
          </Route>
          <Route element={<AdminRoute permission="product.create" />}>
            <Route path="/admin/configuration/products/new" element={<ProductWizardPage />} />
          </Route>
          <Route element={<AdminRoute permission="organization.update" />}>
            <Route path="/admin/configuration/organization" element={<OrganizationSettingsPage />} />
          </Route>
          <Route element={<AdminRoute permission="provider.configure" />}>
            <Route path="/admin/configuration/providers" element={<ProvidersPage />} />
          </Route>

          <Route element={<AdminRoute permission="staff.manage" />}>
            <Route path="/admin/staff-users" element={<StaffUsersPage />} />
          </Route>
          <Route element={<AdminRoute permission="audit.view" />}>
            <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
