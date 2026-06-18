import React, { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CheckCircle2, Clock, FileText, Users, WalletCards, XCircle } from 'lucide-react';
import { api } from '../../api/client';
import ChartCard from '../../components/ChartCard';
import StatCard from '../../components/StatCard';
import { showErrorToast } from '../../utils/toast';

const colors = ['#0f766e', '#dc2626', '#b7791f', '#2563eb'];

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/admin/dashboard')
      .then((response) => setData(response.data))
      .catch((err) => setError(showErrorToast(err)));
  }, []);

  if (error) return <div className="panel p-6 text-sm text-rose-700">{error}</div>;
  if (!data) return <div className="panel p-6 text-sm text-slate-500">Loading admin dashboard...</div>;

  const summary = data.summary;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Admin dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Portfolio health, loan decisions, and repayment operations.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Users" value={summary.totalUsers} icon={Users} />
        <StatCard title="Applications" value={summary.totalLoanApplications} icon={FileText} />
        <StatCard title="Approved" value={summary.approvedLoans} icon={CheckCircle2} />
        <StatCard title="Rejected" value={summary.rejectedLoans} icon={XCircle} />
        <StatCard title="Pending" value={summary.pendingLoans} icon={Clock} />
        <StatCard title="Active loans" value={summary.activeLoans} icon={WalletCards} />
        <StatCard title="Overdue repayments" value={summary.overdueRepayments} icon={AlertTriangle} tone="text-red-600" />
        <StatCard title="Outstanding" value={money(summary.totalOutstanding)} icon={WalletCards} />
        <StatCard title="Collected" value={money(summary.collectedAmount)} icon={CheckCircle2} />
        <StatCard title="Average risk" value={`${summary.averageRiskScore}/100`} icon={FileText} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Approvals vs rejections">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.charts.approvalsVsRejections} dataKey="value" nameKey="name" outerRadius={90} label>
                {data.charts.approvalsVsRejections.map((entry, index) => (
                  <Cell key={entry.name} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Monthly loan activity">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.monthlyLoanActivity}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="applications" fill="#2563eb" />
              <Bar dataKey="approved" fill="#0f766e" />
              <Bar dataKey="rejected" fill="#dc2626" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Repayment status">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.repaymentStatus}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#0f766e" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Pending loans">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.pendingLoans}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#b7791f" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Applications by status">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.applicationsByStatus}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Risk distribution">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.charts.riskDistribution} dataKey="value" nameKey="name" outerRadius={90} label>
                {data.charts.riskDistribution.map((entry, index) => (
                  <Cell key={entry.name} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
}
