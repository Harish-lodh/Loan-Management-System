import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, CircleDot, Copy, FileText, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { ErrorState, LoadingState } from '../../components/AsyncState';
import ScoreBreakdown from '../../components/ScoreBreakdown';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatLabel, formatMoney } from '../../utils/format';
import { showErrorToast, showSuccessToast } from '../../utils/toast';

const MANUAL_STEPS = ['KYC_PENDING', 'KYC_IN_PROGRESS', 'DOCUMENT_PENDING', 'DOCUMENT_VERIFICATION', 'BANK_VERIFICATION_PENDING'];
const REVIEW_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'UNDER_REVIEW'];
const LEGACY_REVIEW_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'PENDING', 'AUTO_REVIEWED'];
const REJECTED = ['CREDIT_REJECTED', 'REJECTED'];

// Who is expected to act at each stage; shown to users who cannot act so they know who to follow up with.
const OWNER = {
  DRAFT: 'Operations',
  KYC_PENDING: 'Operations',
  KYC_IN_PROGRESS: 'Operations',
  DOCUMENT_PENDING: 'Operations',
  DOCUMENT_VERIFICATION: 'Operations',
  BANK_VERIFICATION_PENDING: 'Operations',
  SUBMITTED: 'Credit Officer',
  IN_REVIEW: 'Credit Officer',
  UNDER_REVIEW: 'Credit Officer',
  AGREEMENT_PENDING: 'Operations',
  ESIGN_PENDING: 'Operations',
  ENACH_PENDING: 'Operations',
  READY_FOR_DISBURSEMENT: 'Operations',
  DISBURSEMENT_PENDING: 'Operations',
};

function Stepper({ steps, status }) {
  if (!steps?.length) return null;
  const rejected = REJECTED.includes(status);
  const currentIndex = steps.findIndex((step) => step.status === status);
  const finished = status === 'ACTIVE' || status === 'CLOSED';
  return (
    <ol className="panel flex flex-wrap gap-x-5 gap-y-3 p-4 text-sm">
      {steps.map((step, index) => {
        const done = finished || (currentIndex !== -1 && index < currentIndex);
        const current = !finished && index === currentIndex;
        const Icon = done ? CheckCircle2 : current ? (rejected ? XCircle : CircleDot) : Circle;
        const tone = done ? 'text-emerald-600' : current ? (rejected ? 'text-rose-600' : 'text-bank') : 'text-slate-300';
        return (
          <li key={step.stepKey ?? step.status} className="flex items-center gap-1.5">
            <Icon size={16} className={tone} />
            <span className={current ? 'font-semibold text-slate-950' : done ? 'text-slate-700' : 'text-slate-400'}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <div className="font-medium text-slate-900">{children}</div>
    </div>
  );
}

export default function LoanReviewDetailsPage() {
  const { id } = useParams();
  const { can, user } = useAuth();
  const [application, setApplication] = useState(null);
  const [operations, setOperations] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [utr, setUtr] = useState('');
  const [bankReference, setBankReference] = useState('');

  const configurable = Boolean(application?.productId);

  async function load() {
    try {
      const { data } = await api.get(`/admin/loan-applications/${id}`);
      setApplication(data);
      if (data.productId) {
        const [ops, transitions] = await Promise.all([
          api.get(`/api/v1/loan-applications/${id}/operations`),
          api.get(`/api/v1/loan-applications/${id}/timeline`),
        ]);
        setOperations(ops.data);
        setTimeline(transitions.data);
      }
    } catch (err) {
      setError(showErrorToast(err));
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function run(action, message) {
    setBusy(true);
    try {
      await action();
      showSuccessToast(message);
      setComment('');
      await load();
    } catch (err) {
      showErrorToast(err);
    } finally {
      setBusy(false);
    }
  }

  async function viewAgreement() {
    try {
      const { data } = await api.get(`/api/v1/loan-applications/${id}/agreements`);
      const latest = data[0];
      if (!latest?.contentHtml) {
        showErrorToast(new Error('No agreement content found'));
        return;
      }
      const url = URL.createObjectURL(new Blob([latest.contentHtml], { type: 'text/html' }));
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      showErrorToast(err);
    }
  }

  function copy(text) {
    navigator.clipboard?.writeText(text).then(() => showSuccessToast('Link copied'));
  }

  if (error) return <ErrorState message={error} />;
  if (!application) return <LoadingState label="Loading application..." />;

  const status = application.status;
  const isMaker = application.createdById && application.createdById === user?.id;
  const customer = application.customer;
  const steps = application.workflowSnapshot;
  const amount = application.approvedAmount ?? application.requestedAmount ?? application.amount;
  const post = (path, body) => () => api.post(`/api/v1${path}`, body ?? {});

  function actionPanel() {
    if (!configurable) {
      // Applications created before configurable products: approval books the loan directly.
      if (!LEGACY_REVIEW_STATUSES.includes(status) || !(can('application.approve') || can('application.reject'))) return null;
      return (
        <ReviewBox
          busy={busy}
          comment={comment}
          setComment={setComment}
          isMaker={isMaker}
          canApprove={can('application.approve')}
          canReject={can('application.reject')}
          onApprove={() => run(() => api.patch(`/admin/loan-applications/${id}/approve`, { comment }), 'Loan approved and booked')}
          onReject={() => run(() => api.patch(`/admin/loan-applications/${id}/reject`, { comment }), 'Application rejected')}
        />
      );
    }

    if (status === 'DRAFT' && can('application.create')) {
      return (
        <ActionCard title="Draft" text="Check the details, then submit to run the product's eligibility rules.">
          <button className="btn-primary" disabled={busy} onClick={() => run(post(`/loan-applications/${id}/submit`), 'Application submitted')}>
            Submit application
          </button>
        </ActionCard>
      );
    }

    if (MANUAL_STEPS.includes(status) && can('application.review')) {
      return (
        <ActionCard title={formatLabel(status)} text="Complete this verification offline, add a note for the audit trail, then mark it done.">
          <textarea rows={2} placeholder="Verification note (optional)" value={comment} onChange={(event) => setComment(event.target.value)} />
          <button className="btn-primary" disabled={busy} onClick={() => run(post(`/loan-applications/${id}/advance`, { comments: comment || undefined }), 'Step completed')}>
            Mark {formatLabel(status).replace(' Pending', '')} complete
          </button>
        </ActionCard>
      );
    }

    if (REVIEW_STATUSES.includes(status) && (can('application.approve') || can('application.reject'))) {
      return (
        <ReviewBox
          busy={busy}
          comment={comment}
          setComment={setComment}
          isMaker={isMaker}
          canApprove={can('application.approve')}
          canReject={can('application.reject')}
          approvedAmount={approvedAmount}
          setApprovedAmount={setApprovedAmount}
          requestedAmount={application.requestedAmount ?? application.amount}
          onApprove={() =>
            run(
              post(`/loan-applications/${id}/approve`, {
                comments: comment || undefined,
                ...(approvedAmount ? { approvedAmount: Number(approvedAmount) } : {}),
              }),
              'Application approved',
            )
          }
          onReject={() => run(post(`/loan-applications/${id}/reject`, { comments: comment }), 'Application rejected')}
        />
      );
    }

    if (status === 'AGREEMENT_PENDING' && can('agreement.generate')) {
      return (
        <ActionCard title="Loan agreement" text="Generate the agreement from the product's published template.">
          <button className="btn-primary" disabled={busy} onClick={() => run(post(`/loan-applications/${id}/agreements/generate`), 'Agreement generated')}>
            Generate agreement
          </button>
        </ActionCard>
      );
    }

    if (status === 'ESIGN_PENDING' && can('esign.initiate')) {
      const esign = operations?.esign;
      if (!esign) {
        return (
          <ActionCard title="eSign" text="Send the agreement to the customer for Aadhaar eSign.">
            <button className="btn-primary" disabled={busy} onClick={() => run(post(`/loan-applications/${id}/esign/initiate`), 'Signing link created')}>
              Send for eSign
            </button>
          </ActionCard>
        );
      }
      return (
        <ActionCard
          title="Waiting for customer signature"
          text={
            esign.manualConfirmation
              ? 'No live eSign provider is configured. Once the customer has signed (physically or offline), confirm it here.'
              : 'Share the link with the customer. After they sign, check the status with the provider.'
          }
        >
          {esign.signingUrl ? (
            <button className="btn-secondary" onClick={() => copy(esign.signingUrl)}>
              <Copy size={16} /> Copy signing link
            </button>
          ) : null}
          {esign.manualConfirmation ? (
            <textarea rows={2} placeholder="Note, e.g. signed copy received on 12 Oct" value={comment} onChange={(event) => setComment(event.target.value)} />
          ) : null}
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() => run(post(`/esign-requests/${esign.id}/confirm`, { comments: comment || undefined }), 'Signature confirmed')}
          >
            {esign.manualConfirmation ? 'Confirm customer has signed' : 'Check signing status'}
          </button>
        </ActionCard>
      );
    }

    if (status === 'ENACH_PENDING' && can('enach.initiate')) {
      const enach = operations?.enach;
      if (!enach) {
        return (
          <ActionCard title="eNACH mandate" text={`Register an auto-debit mandate (up to ${formatMoney(Number(application.emi) * 2)} per debit).`}>
            <button className="btn-primary" disabled={busy} onClick={() => run(post(`/loan-applications/${id}/enach/initiate`), 'Mandate created')}>
              Start eNACH registration
            </button>
          </ActionCard>
        );
      }
      return (
        <ActionCard title="Waiting for mandate registration" text={`Mandate ${enach.mandateReference}. Confirm once the customer's bank has approved it.`}>
          <textarea rows={2} placeholder="Note, e.g. UMRN from the bank" value={comment} onChange={(event) => setComment(event.target.value)} />
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() => run(post(`/enach-mandates/${enach.id}/confirm`, { comments: comment || undefined }), 'Mandate registered')}
          >
            Confirm mandate registered
          </button>
        </ActionCard>
      );
    }

    if (status === 'READY_FOR_DISBURSEMENT' && can('disbursement.initiate')) {
      return (
        <ActionCard
          title="Ready for disbursement"
          text={`Net amount to transfer: ${formatMoney(application.netDisbursementAmount ?? amount)} (after ${formatMoney(application.pricingBreakdown?.processingFee ?? 0)} processing fee).`}
        >
          <button className="btn-primary" disabled={busy} onClick={() => run(post(`/loan-applications/${id}/disbursements`), 'Disbursement initiated')}>
            Initiate disbursement
          </button>
        </ActionCard>
      );
    }

    if (status === 'DISBURSEMENT_PENDING' && can('disbursement.initiate') && operations?.disbursement) {
      const disbursement = operations.disbursement;
      if (disbursement.initiatedBy === user?.id) {
        return (
          <ActionCard
            title="Waiting for a second approver"
            text={`You initiated this ${formatMoney(disbursement.netAmount)} transfer, so a different Operations or Admin user must confirm it with the UTR (maker-checker).`}
          />
        );
      }
      return (
        <ActionCard
          title="Confirm the bank transfer"
          text={`Transfer ${formatMoney(disbursement.netAmount)} to the customer's account, then enter the UTR. This books the loan and creates the EMI schedule.`}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <input placeholder="UTR number *" value={utr} onChange={(event) => setUtr(event.target.value.trim())} />
            <input placeholder="Bank reference (optional)" value={bankReference} onChange={(event) => setBankReference(event.target.value)} />
          </div>
          <button
            className="btn-primary"
            disabled={busy || utr.length < 6}
            onClick={() =>
              run(
                post(`/disbursements/${disbursement.id}/confirm`, { utr, ...(bankReference ? { bankReference } : {}) }),
                'Disbursement confirmed, loan is active',
              )
            }
          >
            Confirm disbursement
          </button>
        </ActionCard>
      );
    }

    if (OWNER[status]) {
      return (
        <div className="panel p-4 text-sm text-slate-600">
          Waiting on <span className="font-semibold">{OWNER[status]}</span> to complete “{formatLabel(status)}”.
        </div>
      );
    }
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">{application.applicationNumber || 'Loan application'}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {customer ? (
              <Link className="font-semibold text-bank" to={`/admin/customers/${customer.id}`}>
                {customer.fullName}
              </Link>
            ) : null}{' '}
            · {customer?.customerNumber} · {customer?.phone}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      <Stepper steps={steps} status={status} />

      {REJECTED.includes(status) ? (
        <div className="panel border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          Rejected{application.adminComment ? `: ${application.adminComment}` : ''}
          {application.ruleEvaluationResult && !application.ruleEvaluationResult.passed ? ` (${application.ruleEvaluationResult.reason})` : ''}
        </div>
      ) : null}

      {actionPanel()}

      {operations?.loan ? (
        <div className="panel flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <div>
            <p className="flex items-center gap-2 font-semibold">
              Loan {operations.loan.loanAccountNumber}
              {operations.loan.assetClassification ? <StatusBadge status={operations.loan.assetClassification} /> : null}
              {operations.loan.dpd ? <span className="text-xs font-normal text-red-600">{operations.loan.dpd} DPD</span> : null}
            </p>
            <p className="text-slate-500">
              Disbursed {formatDate(operations.loan.disbursedAt)} · Outstanding {formatMoney(operations.loan.outstandingBalance)} · First EMI {formatDate(operations.loan.firstDueDate)}
            </p>
          </div>
          <Link className="btn-secondary" to="/admin/repayments">
            View repayments
          </Link>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <div className="panel p-4">
          <p className="text-sm text-slate-500">{application.approvedAmount ? 'Approved amount' : 'Requested amount'}</p>
          <p className="mt-2 text-xl font-semibold">{formatMoney(amount)}</p>
        </div>
        <div className="panel p-4">
          <p className="text-sm text-slate-500">EMI · tenure</p>
          <p className="mt-2 text-xl font-semibold">
            {formatMoney(application.emi)} · {application.tenureMonths}m
          </p>
        </div>
        <div className="panel p-4">
          <p className="text-sm text-slate-500">Risk score</p>
          <p className="mt-2 text-xl font-semibold">{application.riskScore}/100</p>
        </div>
        <div className="panel p-4">
          <p className="text-sm text-slate-500">Credit score</p>
          <p className="mt-2 text-xl font-semibold">{application.creditScore}</p>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="font-semibold">Assessment</h2>
        <p className="mt-2 text-sm text-slate-600">{application.riskExplanation}</p>
        <div className="mt-4 grid gap-4 text-sm md:grid-cols-4">
          <Field label="Monthly income">{formatMoney(application.monthlyIncome)}</Field>
          <Field label="Existing EMIs">{formatMoney(application.existingMonthlyDebt)}</Field>
          <Field label="Employment">{formatLabel(application.employmentType)}</Field>
          <Field label="Interest rate">{Number(application.annualInterestRate)}% p.a.</Field>
          <Field label="Purpose">{application.purpose}</Field>
          {application.pricingBreakdown ? <Field label="Processing fee">{formatMoney(application.pricingBreakdown.processingFee)}</Field> : null}
          {application.netDisbursementAmount ? <Field label="Net disbursal">{formatMoney(application.netDisbursementAmount)}</Field> : null}
          {application.ruleEvaluationResult ? (
            <Field label="Eligibility rules">{application.ruleEvaluationResult.passed ? 'Passed' : 'Failed'}</Field>
          ) : null}
        </div>
        {application.dynamicFields && Object.keys(application.dynamicFields).length ? (
          <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 text-sm md:grid-cols-4">
            {Object.entries(application.dynamicFields).map(([key, value]) => (
              <Field key={key} label={formatLabel(key)}>
                {String(value)}
              </Field>
            ))}
          </div>
        ) : null}
        <div className="mt-5">
          <ScoreBreakdown items={application.scoreBreakdown} />
        </div>
      </section>

      {operations && (operations.agreements.length || operations.esign || operations.enach || operations.disbursement) ? (
        <section className="panel p-5">
          <h2 className="font-semibold">Documents & provider steps</h2>
          <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
            {operations.agreements.length ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
                <div>
                  <p className="font-medium">Loan agreement</p>
                  <p className="text-xs text-slate-500">Generated {formatDate(operations.agreements[0].createdAt)}</p>
                </div>
                <button className="btn-secondary" onClick={viewAgreement}>
                  <FileText size={16} /> View
                </button>
              </div>
            ) : null}
            {operations.esign ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
                <div>
                  <p className="font-medium">eSign</p>
                  <p className="text-xs text-slate-500">{operations.esign.signedAt ? `Signed ${formatDate(operations.esign.signedAt)}` : 'Awaiting signature'}</p>
                </div>
                <StatusBadge status={operations.esign.status} />
              </div>
            ) : null}
            {operations.enach ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
                <div>
                  <p className="font-medium">eNACH {operations.enach.mandateReference}</p>
                  <p className="text-xs text-slate-500">Max debit {formatMoney(operations.enach.maximumAmount)}</p>
                </div>
                <StatusBadge status={operations.enach.status} />
              </div>
            ) : null}
            {operations.disbursement ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
                <div>
                  <p className="font-medium">Disbursement {formatMoney(operations.disbursement.netAmount)}</p>
                  <p className="text-xs text-slate-500">{operations.disbursement.utr ? `UTR ${operations.disbursement.utr}` : operations.disbursement.disbursementReference}</p>
                </div>
                <StatusBadge status={operations.disbursement.status} />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="panel p-5">
        <h2 className="font-semibold">History</h2>
        <div className="mt-4 space-y-3">
          {(timeline.length ? timeline : application.statusHistory || []).map((entry, index) => (
            <div key={entry.id ?? `${entry.status}-${index}`} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0">
              <div>
                <p className="font-medium">{formatLabel(entry.newStatus ?? entry.status)}</p>
                <p className="text-sm text-slate-500">
                  {entry.reason ?? entry.comment ?? 'Status changed'}
                  {entry.actorRole ? ` · ${formatLabel(entry.actorRole)}` : ''}
                </p>
              </div>
              <span className="text-xs text-slate-500">{new Date(entry.createdAt ?? entry.changedAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ActionCard({ title, text, children }) {
  return (
    <section className="panel space-y-3 border-bank/30 p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-bank">Next step</p>
        <h2 className="mt-1 text-base font-semibold text-slate-950">{title}</h2>
        {text ? <p className="mt-1 text-sm text-slate-600">{text}</p> : null}
      </div>
      <div className="flex flex-col gap-3 sm:items-start">{children}</div>
    </section>
  );
}

function ReviewBox({ busy, comment, setComment, isMaker, canApprove, canReject, approvedAmount, setApprovedAmount, requestedAmount, onApprove, onReject }) {
  return (
    <ActionCard title="Credit decision" text="Approve or reject with a reason. Your comment is stored in the audit trail.">
      {isMaker ? (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          You captured this application, so a different staff member must approve it (maker-checker). You can still reject it.
        </p>
      ) : null}
      {setApprovedAmount && canApprove ? (
        <div className="w-full sm:max-w-xs">
          <label>Approved amount (optional)</label>
          <input
            type="number"
            min="1"
            placeholder={`Requested ${formatMoney(requestedAmount)}`}
            value={approvedAmount}
            onChange={(event) => setApprovedAmount(event.target.value)}
          />
        </div>
      ) : null}
      <textarea className="w-full" rows={3} placeholder="Comment (required to reject)" value={comment} onChange={(event) => setComment(event.target.value)} />
      <div className="flex flex-wrap gap-3">
        {canApprove ? (
          <button className="btn-primary" disabled={busy || isMaker} onClick={onApprove}>
            Approve
          </button>
        ) : null}
        {canReject ? (
          <button className="btn-secondary text-rose-700" disabled={busy || comment.trim().length < 5} onClick={onReject}>
            Reject
          </button>
        ) : null}
      </div>
    </ActionCard>
  );
}
