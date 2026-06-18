import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AdminRoute from './components/AdminRoute';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminMastersPage from './pages/admin/AdminMastersPage';
import AdminRepaymentsPage from './pages/admin/AdminRepaymentsPage';
import AuditLogsPage from './pages/admin/AuditLogsPage';
import LoanApplicationsPage from './pages/admin/LoanApplicationsPage';
import LoanReviewDetailsPage from './pages/admin/LoanReviewDetailsPage';
import UserDetailsPage from './pages/admin/UserDetailsPage';
import UsersListPage from './pages/admin/UsersListPage';
import LandingPage from './pages/public/LandingPage';
import LoginPage from './pages/public/LoginPage';
import RegisterPage from './pages/public/RegisterPage';
import ApplyLoanPage from './pages/user/ApplyLoanPage';
import EmiCalculatorPage from './pages/user/EmiCalculatorPage';
import LoanDetailsPage from './pages/user/LoanDetailsPage';
import MyLoansPage from './pages/user/MyLoansPage';
import NotificationsPage from './pages/user/NotificationsPage';
import ProfilePage from './pages/user/ProfilePage';
import RepaymentsPage from './pages/user/RepaymentsPage';
import UserDashboard from './pages/user/UserDashboard';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<UserDashboard />} />
          <Route path="/apply" element={<ApplyLoanPage />} />
          <Route path="/calculator" element={<EmiCalculatorPage />} />
          <Route path="/loans" element={<MyLoansPage />} />
          <Route path="/loans/:id" element={<LoanDetailsPage />} />
          <Route path="/repayments" element={<RepaymentsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/masters" element={<AdminMastersPage />} />
            <Route path="/admin/users" element={<UsersListPage />} />
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
