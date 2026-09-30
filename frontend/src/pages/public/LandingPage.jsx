import React from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main>
        <section className="border-b border-slate-200 bg-paper">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 lg:grid-cols-[1fr_0.9fr] lg:px-6">
            <div className="flex flex-col justify-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-bank">Internal lending operations</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">LedgerLine Loans</h1>
              <p className="mt-5 max-w-2xl text-lg text-slate-600">
                Origination, underwriting, eSign, disbursement, and repayment collection for NBFC lending and partner/fintech
                programs. Internal staff and partner-integration use only.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/login" className="btn-primary">
                  Staff login
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>
            <div className="panel p-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  ['Approval rate', '72%'],
                  ['Active loans', '48'],
                  ['Audit chain', 'Valid'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-2 text-xl font-semibold text-slate-950">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Applicant</th>
                      <th className="px-3 py-2">Risk</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      ['Maya Sharma', '82', 'Approved'],
                      ['Arjun Mehta', '64', 'Review'],
                      ['Priya Nair', '51', 'Pending'],
                    ].map((row) => (
                      <tr key={row[0]}>
                        <td className="px-3 py-3 font-medium">{row[0]}</td>
                        <td className="px-3 py-3">{row[1]}</td>
                        <td className="px-3 py-3">{row[2]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
        <section className="mx-auto grid max-w-7xl gap-4 px-4 py-10 md:grid-cols-3 lg:px-6">
          {[
            [ShieldCheck, 'Transparent scoring', 'Rule-based lending decisions with plain-language explanations.'],
            [WalletCards, 'Repayment tracking', 'Schedules, due dates, progress, overdue handling, and demo payments.'],
            [CheckCircle2, 'Tamper-evident audit', 'Every major action is chained with SHA-256 hashes.'],
          ].map(([Icon, title, text]) => (
            <article key={title} className="panel p-5">
              <Icon className="text-bank" size={24} />
              <h2 className="mt-4 font-semibold text-slate-950">{title}</h2>
              <p className="mt-2 text-sm text-slate-600">{text}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
