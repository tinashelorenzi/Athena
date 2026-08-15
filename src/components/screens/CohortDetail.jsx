'use client';
import React, { useState, useActionState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { deleteCohort, bindScenarios, unbindScenario, removeFromCohort } from '@/app/actions/cohorts';
import { sendInvitations, revokeInvitation } from '@/app/actions/invitations';
import { createStudent } from '@/app/actions/students';
import { generatePassword } from '@/lib/password-gen';
import { GradeReviewDialog } from './grading/GradeReviewDialog';
import { Textarea } from './scenarios/primitives';
import { FormStatus } from './settings/parts';

const TYPE_META = { DOJO: { tone: 'brand', label: 'Dojo' }, ASSESSMENT: { tone: 'accent', label: 'Assessment' } };

const TABS = [
  { id: 'members', label: 'Members', icon: <Icon name="Users" size={15} /> },
  { id: 'invite', label: 'Add students', icon: <Icon name="UserPlus" size={15} /> },
  { id: 'scenarios', label: 'Scenarios', icon: <Icon name="Boxes" size={15} /> },
  { id: 'grading', label: 'Grading', icon: <Icon name="GraduationCap" size={15} /> },
  { id: 'standings', label: 'Standings', icon: <Icon name="Trophy" size={15} /> },
];

export function CohortDetail({ cohort, leaderboard, students, bound, invitations, allScenarios, submissions }) {
  const [tab, setTab] = useState('members');
  const [confirmDel, setConfirmDel] = useState(false);
  const [error, setError] = useState(null);

  return (
    <div style={{ padding: 24, maxWidth: 940, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link href="/admin/cohorts" style={{ textDecoration: 'none' }}><AC.IconButton label="Back"><Icon name="ArrowLeft" size={18} /></AC.IconButton></Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 19, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{cohort.name}</h2>
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{students.length} students · {bound.length} scenarios · {invitations.length} pending invites</div>
        </div>
        <AC.Button variant="outline-danger" size="sm" leadingIcon={<Icon name="Trash2" size={14} />} onClick={() => setConfirmDel(true)}>Delete</AC.Button>
      </div>

      {error && <AC.Toast tone="danger" title="Something went wrong" message={error} onClose={() => setError(null)} />}

      <AC.Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'members' && <MembersTab cohort={cohort} students={students} onError={setError} />}
      {tab === 'invite' && <InviteTab cohort={cohort} invitations={invitations} onError={setError} />}
      {tab === 'scenarios' && <ScenariosTab cohort={cohort} bound={bound} allScenarios={allScenarios} onError={setError} />}
      {tab === 'grading' && <GradingTab submissions={submissions} onError={setError} />}
      {tab === 'standings' && <StandingsTab leaderboard={leaderboard} />}

      <AC.Dialog
        open={confirmDel}
        title="Delete cohort?"
        description={`"${cohort.name}" will be deleted. Students are detached (their accounts remain); scenario bindings and pending invitations are removed.`}
        icon={<Icon name="Trash2" size={18} />}
        onClose={() => setConfirmDel(false)}
        footer={<>
          <AC.Button variant="ghost" onClick={() => setConfirmDel(false)}>Cancel</AC.Button>
          <AC.Button variant="danger" leadingIcon={<Icon name="Trash2" size={14} />} onClick={() => { setConfirmDel(false); deleteCohort(cohort.id); }}>Delete cohort</AC.Button>
        </>}
      />
    </div>
  );
}

function MembersTab({ cohort, students, onError }) {
  const [busyId, setBusyId] = useState(null);
  const remove = async (s) => {
    setBusyId(s.id);
    const res = await removeFromCohort(s.id, cohort.id);
    setBusyId(null);
    if (res?.error) onError(res.error);
  };
  return (
    <AC.Card padded={false}>
      {students.length === 0 ? (
        <div style={{ padding: 8 }}><AC.EmptyState icon={<Icon name="Users" size={22} />} title="No students yet" description="Invite students on the Invite tab, or set a student's cohort on the Students page." /></div>
      ) : (
        <AC.Table
          rowKey="id"
          hover={false}
          columns={[
            { key: 'name', header: 'Name', primary: true },
            { key: 'email', header: 'Email', mono: true },
            { key: 'id', header: '', align: 'right', width: '110px', render: (_v, row) => (
              <AC.Button variant="ghost" size="sm" loading={busyId === row.id} leadingIcon={<Icon name="UserMinus" size={14} />} onClick={() => remove(row)}>Remove</AC.Button>
            ) },
          ]}
          rows={students}
        />
      )}
    </AC.Card>
  );
}

/* Create a student account directly in this cohort (no email needed). The
   instructor sets/generates the password and hands it over — shown once. */
function ManualAddCard({ cohort, onError }) {
  const [pwd, setPwd] = useState('');
  const [creating, startCreate] = useTransition();
  const [cred, setCred] = useState(null);
  const formRef = React.useRef(null);

  // Seed a strong password after mount (client-only, so it can't cause an SSR
  // hydration mismatch on the input's value).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => { setPwd(generatePassword()); }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set('cohortId', cohort.id);
    startCreate(async () => {
      const res = await createStudent({}, formData);
      if (res?.error) { onError(res.error); return; }
      setCred({ email: res.created.email, password: res.created.password, name: res.created.name });
      form.reset();
      setPwd(generatePassword());
    });
  };

  return (
    <AC.Card header={<SecHeader icon="UserPlus" title="Add a student directly" subtitle={`Create an account in ${cohort.name} with a password you generate — no email required.`} />}>
      <form ref={formRef} onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}><AC.Input label="Full name" name="name" placeholder="e.g. Amara Okafor" required leadingIcon={<Icon name="User" size={16} />} /></div>
          <div style={{ flex: '1 1 200px' }}><AC.Input label="Email" name="email" type="email" placeholder="student@zaio.io" required leadingIcon={<Icon name="Mail" size={16} />} /></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Password</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}><AC.Input name="password" value={pwd} onChange={(e) => setPwd(e.target.value)} mono placeholder="At least 10 characters" leadingIcon={<Icon name="KeyRound" size={16} />} /></div>
            <AC.Button type="button" variant="secondary" leadingIcon={<Icon name="RefreshCw" size={14} />} onClick={() => setPwd(generatePassword())}>Generate</AC.Button>
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>Shown once after creating — copy it then. Or type your own.</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <AC.Button type="submit" variant="primary" loading={creating} leadingIcon={<Icon name="UserPlus" size={14} />}>Create student</AC.Button>
        </div>
      </form>
      <CohortCredentialDialog key={cred ? cred.password : 'none'} cred={cred} onClose={() => setCred(null)} />
    </AC.Card>
  );
}

function CohortCredentialDialog({ cred, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!cred) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${cred.email}\n${cred.password}`); setCopied(true); } catch { /* clipboard blocked */ }
  };
  const field = (label, value) => (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{value}</div>
    </div>
  );
  return (
    <AC.Dialog
      open
      title={`Account created — ${cred.name}`}
      description="Copy these now — the password is shown only once and can only be reset, not recovered."
      icon={<Icon name="KeyRound" size={18} />}
      onClose={onClose}
      footer={<>
        <AC.Button variant="secondary" leadingIcon={<Icon name={copied ? 'Check' : 'Copy'} size={14} />} onClick={copy}>{copied ? 'Copied' : 'Copy'}</AC.Button>
        <AC.Button variant="primary" onClick={onClose}>Done</AC.Button>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-inset)', border: '1px solid var(--border-default)' }}>
        {field('Email', cred.email)}
        {field('Password', cred.password)}
      </div>
    </AC.Dialog>
  );
}

function InviteTab({ cohort, invitations, onError }) {
  const [state, action, sending] = useActionState(sendInvitations, {});
  const [busyId, setBusyId] = useState(null);

  const revoke = async (inv) => {
    setBusyId(inv.id);
    const res = await revokeInvitation(inv.id);
    setBusyId(null);
    if (res?.error) onError(res.error);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ManualAddCard cohort={cohort} onError={onError} />

      <AC.Card header={<SecHeader icon="MailPlus" title="Invite by email" subtitle="Upload a .txt of emails (one per line) or paste them. Each gets an email with a link to set their name + password. (Requires SMTP in Settings → Mail.)" />}>
        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input type="hidden" name="cohortId" value={cohort.id} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Upload .txt (one email per line)</label>
            <input type="file" name="emailsFile" accept=".txt,text/plain" style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>…or paste emails</label>
            <Textarea name="emailsText" mono rows={5} placeholder={'ada@example.com\nalan@example.com'} />
          </div>
          <FormStatus state={state} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <AC.Button type="submit" variant="primary" loading={sending} leadingIcon={<Icon name="Send" size={14} />}>Send invitations</AC.Button>
          </div>
        </form>
      </AC.Card>

      <AC.Card header={<SecHeader icon="Clock" title={`Pending invitations (${invitations.length})`} subtitle="Awaiting the student to accept." />} padded={false}>
        {invitations.length === 0 ? (
          <div style={{ padding: 16, fontSize: 12.5, color: 'var(--text-tertiary)' }}>No pending invitations.</div>
        ) : (
          <AC.Table
            rowKey="id"
            hover={false}
            columns={[
              { key: 'email', header: 'Email', primary: true, mono: true },
              { key: 'created', header: 'Sent', mono: true, width: '120px' },
              { key: 'expires', header: 'Expires', mono: true, width: '120px' },
              { key: 'id', header: '', align: 'right', width: '110px', render: (_v, row) => (
                <AC.Button variant="ghost" size="sm" loading={busyId === row.id} leadingIcon={<Icon name="X" size={14} />} onClick={() => revoke(row)}>Revoke</AC.Button>
              ) },
            ]}
            rows={invitations}
          />
        )}
      </AC.Card>
    </div>
  );
}

function ScenariosTab({ cohort, bound, allScenarios, onError }) {
  const [bindOpen, setBindOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const boundIds = new Set(bound.map((b) => b.scenarioId));

  const unbind = async (b) => {
    setBusyId(b.bindingId);
    const res = await unbindScenario(b.bindingId);
    setBusyId(null);
    if (res?.error) onError(res.error);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <AC.Card
        padded={false}
        header={<div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
          <div style={{ flex: 1 }}><SecHeader icon="Boxes" title="Bound scenarios" subtitle="Released to this cohort's students — including hidden dojos." /></div>
          <AC.Button variant="primary" size="sm" leadingIcon={<Icon name="Plus" size={14} />} onClick={() => setBindOpen(true)}>Bind scenario</AC.Button>
        </div>}
      >
        {bound.length === 0 ? (
          <div style={{ padding: 8 }}><AC.EmptyState icon={<Icon name="Boxes" size={22} />} title="No scenarios bound" description="Bind a scenario to release it to this cohort." actions={<AC.Button variant="primary" size="sm" onClick={() => setBindOpen(true)}>Bind scenario</AC.Button>} /></div>
        ) : (
          <AC.Table
            rowKey="bindingId"
            hover={false}
            columns={[
              { key: 'title', header: 'Scenario', primary: true },
              { key: 'type', header: 'Type', width: '130px', render: (v) => <AC.Badge tone={TYPE_META[v].tone} square>{TYPE_META[v].label}</AC.Badge> },
              { key: 'bindingId', header: '', align: 'right', width: '110px', render: (_v, row) => (
                <AC.Button variant="ghost" size="sm" loading={busyId === row.bindingId} leadingIcon={<Icon name="Unlink" size={14} />} onClick={() => unbind(row)}>Unbind</AC.Button>
              ) },
            ]}
            rows={bound}
          />
        )}
      </AC.Card>

      <BindDialog open={bindOpen} onClose={() => setBindOpen(false)} cohortId={cohort.id} scenarios={allScenarios.filter((s) => !boundIds.has(s.id))} onError={onError} />
    </div>
  );
}

function BindDialog({ open, onClose, cohortId, scenarios, onError }) {
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const toggle = (id) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const submit = async () => {
    if (selected.size === 0) { onError('Select at least one scenario.'); return; }
    setBusy(true);
    const res = await bindScenarios(cohortId, [...selected]);
    setBusy(false);
    if (res?.error) { onError(res.error); return; }
    setSelected(new Set());
    onClose();
  };

  return (
    <AC.Dialog
      open={open}
      title="Bind scenarios"
      description="Selected scenarios become visible to this cohort's students."
      icon={<Icon name="Link" size={18} />}
      onClose={onClose}
      footer={<>
        <AC.Button variant="ghost" onClick={onClose}>Cancel</AC.Button>
        <AC.Button variant="primary" loading={busy} onClick={submit}>Bind{selected.size ? ` (${selected.size})` : ''}</AC.Button>
      </>}
    >
      {scenarios.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>All authored scenarios are already bound to this cohort.</div>
      ) : (
        <div style={{ maxHeight: 300, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: 8 }}>
          {scenarios.map((s) => (
            <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 6, cursor: 'pointer' }}>
              <AC.Checkbox checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{s.title}</span>
              <AC.Badge tone={TYPE_META[s.type].tone} square>{TYPE_META[s.type].label}</AC.Badge>
            </label>
          ))}
        </div>
      )}
    </AC.Dialog>
  );
}

function GradingTab({ submissions, onError }) {
  const router = useRouter();
  const [grading, setGrading] = useState(null); // submission row

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <AC.Card padded={false} header={<SecHeader icon="GraduationCap" title="Submissions" subtitle="Deliverables submitted by this cohort's students, awaiting or holding a grade." />}>
        {submissions.length === 0 ? (
          <div style={{ padding: 8 }}><AC.EmptyState icon={<Icon name="Inbox" size={22} />} title="No submissions yet" description="Submissions appear here once students complete bound scenarios and submit their deliverables." /></div>
        ) : (
          <AC.Table
            rowKey="id"
            hover={false}
            columns={[
              { key: 'studentName', header: 'Student', primary: true },
              { key: 'scenarioTitle', header: 'Scenario' },
              { key: 'submitted', header: 'Submitted', mono: true, width: '120px' },
              { key: 'status', header: 'Status', width: '160px', render: (v, row) => (
                v !== 'GRADED'
                  ? <AC.Badge tone="accent" dot square>Submitted</AC.Badge>
                  : row.released
                    ? <AC.Badge tone="success" dot square>Released · {row.grade ?? '—'}</AC.Badge>
                    : <AC.Badge tone="warning" dot square>Graded · {row.grade ?? '—'} · held</AC.Badge>
              ) },
              { key: 'id', header: '', align: 'right', width: '100px', render: (_v, row) => (
                <AC.Button variant="secondary" size="sm" leadingIcon={<Icon name="PenLine" size={14} />} onClick={() => setGrading(row)}>{row.status === 'GRADED' ? 'Review' : 'Grade'}</AC.Button>
              ) },
            ]}
            rows={submissions}
          />
        )}
      </AC.Card>

      <GradeReviewDialog key={grading?.id || 'none'} submission={grading} onClose={() => setGrading(null)} onError={onError} onDone={() => router.refresh()} />
    </div>
  );
}

function StandingsTab({ leaderboard }) {
  const rows = (leaderboard || []).map((r, i) => ({ ...r, rank: i + 1 }));
  return (
    <AC.Card padded={false} header={<SecHeader icon="Trophy" title="Standings" subtitle="Reputation earned from graded assessments, highest first." />}>
      {rows.length === 0 ? (
        <div style={{ padding: 8 }}><AC.EmptyState icon={<Icon name="Trophy" size={22} />} title="No standings yet" description="Reputation appears once assessment submissions are graded." /></div>
      ) : (
        <AC.Table
          rowKey="id"
          hover={false}
          columns={[
            { key: 'rank', header: '#', width: '50px', mono: true },
            { key: 'name', header: 'Student', primary: true },
            { key: 'assessments', header: 'Assessments', align: 'right', mono: true, width: '130px' },
            { key: 'reputation', header: 'Reputation', align: 'right', mono: true, width: '120px' },
          ]}
          rows={rows}
        />
      )}
    </AC.Card>
  );
}

function SecHeader({ icon, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Icon name={icon} size={16} style={{ color: 'var(--text-secondary)' }} />
      <div>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{subtitle}</div>}
      </div>
    </div>
  );
}

export default CohortDetail;
