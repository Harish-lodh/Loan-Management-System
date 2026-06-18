import React, { useMemo, useState } from 'react';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

function calculate(principal, annualRate, tenureMonths) {
  const monthlyRate = annualRate / 12 / 100;
  const emi =
    monthlyRate === 0
      ? principal / tenureMonths
      : (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
        (Math.pow(1 + monthlyRate, tenureMonths) - 1);
  let balance = principal;
  const schedule = Array.from({ length: tenureMonths }, (_, index) => {
    const interest = balance * monthlyRate;
    const principalPart = index === tenureMonths - 1 ? balance : emi - interest;
    balance = Math.max(0, balance - principalPart);
    return {
      month: index + 1,
      emi,
      principal: principalPart,
      interest,
      balance,
    };
  });
  return {
    emi,
    totalPayable: emi * tenureMonths,
    totalInterest: emi * tenureMonths - principal,
    schedule,
  };
}

export default function EmiCalculatorPage() {
  const [form, setForm] = useState({ principal: 250000, annualRate: 12, tenureMonths: 24 });
  const result = useMemo(() => calculate(Number(form.principal), Number(form.annualRate), Number(form.tenureMonths)), [form]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">EMI calculator</h1>
        <p className="mt-1 text-sm text-slate-500">Formula: P x R x (1 + R)^N / ((1 + R)^N - 1)</p>
      </div>
      <section className="panel grid gap-4 p-5 md:grid-cols-3">
        {[
          ['principal', 'Principal amount'],
          ['annualRate', 'Annual interest rate'],
          ['tenureMonths', 'Tenure months'],
        ].map(([name, label]) => (
          <div key={name}>
            <label>{label}</label>
            <input type="number" value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} />
          </div>
        ))}
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        <div className="panel p-4">
          <p className="text-sm text-slate-500">Monthly EMI</p>
          <p className="mt-2 text-2xl font-semibold">{money.format(result.emi)}</p>
        </div>
        <div className="panel p-4">
          <p className="text-sm text-slate-500">Total payable</p>
          <p className="mt-2 text-2xl font-semibold">{money.format(result.totalPayable)}</p>
        </div>
        <div className="panel p-4">
          <p className="text-sm text-slate-500">Total interest</p>
          <p className="mt-2 text-2xl font-semibold">{money.format(result.totalInterest)}</p>
        </div>
      </section>
      <section className="panel overflow-hidden">
        <div className="border-b border-slate-200 p-4">
          <h2 className="font-semibold">Repayment schedule</h2>
        </div>
        <div className="max-h-96 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">EMI</th>
                <th className="px-4 py-3">Principal</th>
                <th className="px-4 py-3">Interest</th>
                <th className="px-4 py-3">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.schedule.map((row) => (
                <tr key={row.month}>
                  <td className="px-4 py-3">{row.month}</td>
                  <td className="px-4 py-3">{money.format(row.emi)}</td>
                  <td className="px-4 py-3">{money.format(row.principal)}</td>
                  <td className="px-4 py-3">{money.format(row.interest)}</td>
                  <td className="px-4 py-3">{money.format(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
