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
        <StatCard title="Customers" value={summary.totalCustomers} icon={Users} />
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
      {data.assetQuality ? <AssetQuality quality={data.assetQuality} /> : null}
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

const BUCKET_LABELS = {
  STANDARD: ['Standard', '0 DPD'],
  SMA_0: ['SMA-0', '1–30 DPD'],
  SMA_1: ['SMA-1', '31–60 DPD'],
  SMA_2: ['SMA-2', '61–90 DPD'],
  NPA_SUBSTANDARD: ['NPA – Substandard', '90+ DPD, ≤ 12 months'],
  NPA_DOUBTFUL: ['NPA – Doubtful', 'NPA > 12 months'],
  NPA_LOSS: ['NPA – Loss', 'Identified loss'],
};

// Portfolio quality by RBI IRACP bucket, refreshed by the nightly end-of-day job.
function AssetQuality({ quality }) {
  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-950">Portfolio quality (RBI IRACP)</h2>
          <p className="mt-1 text-sm text-slate-500">Running loans by days past due. Updated every night at 00:30 IST and on each payment.</p>
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <p className="text-slate-500">Gross NPA</p>
            <p className={`text-xl font-semibold ${quality.grossNpaPercent > 0 ? 'text-red-600' : 'text-slate-950'}`}>{quality.grossNpaPercent}%</p>
          </div>
          <div>
            <p className="text-slate-500">PAR 30</p>
            <p className={`text-xl font-semibold ${quality.par30Percent > 0 ? 'text-amber-600' : 'text-slate-950'}`}>{quality.par30Percent}%</p>
          </div>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-4">Classification</th>
              <th className="py-2 pr-4">Loans</th>
              <th className="py-2 pr-4">Outstanding</th>
              <th className="py-2">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quality.buckets.map((bucket) => {
              const [label, range] = BUCKET_LABELS[bucket.classification] ?? [bucket.classification, ''];
              const share = quality.totalOutstanding ? (bucket.outstanding / quality.totalOutstanding) * 100 : 0;
              const npa = bucket.classification.startsWith('NPA_');
              return (
                <tr key={bucket.classification}>
                  <td className="py-2 pr-4">
                    <span className={`font-medium ${npa && bucket.loans ? 'text-red-700' : ''}`}>{label}</span>
                    <span className="ml-2 text-xs text-slate-500">{range}</span>
                  </td>
                  <td className="py-2 pr-4">{bucket.loans}</td>
                  <td className="py-2 pr-4">{money(bucket.outstanding)}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded bg-slate-100">
                        <div className={`h-full ${npa ? 'bg-red-500' : bucket.classification === 'STANDARD' ? 'bg-teal-600' : 'bg-amber-500'}`} style={{ width: `${share}%` }} />
                      </div>
                      <span className="text-xs text-slate-500">{share.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
}
