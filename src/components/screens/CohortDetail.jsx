'use client';
import React, { useState, useActionState } from 'react';
import Link from 'next/link';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { deleteCohort, bindScenarios, unbindScenario, removeFromCohort } from '@/app/actions/cohorts';
import { sendInvitations, revokeInvitation } from '@/app/actions/invitations';
import { gradeSubmission } from '@/app/actions/grading';
import { Textarea } from './scenarios/primitives';
import { FormStatus } from './settings/parts';

const TYPE_META = { DOJO: { tone: 'brand', label: 'Dojo' }, ASSESSMENT: { tone: 'accent', label: 'Assessment' } };

const TABS = [
  { id: 'members', label: 'Members', icon: <Icon name="Users" size={15} /> },
  { id: 'invite', label: 'Invite', icon: <Icon name="MailPlus" size={15} /> },
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
      <AC.Card header={<SecHeader icon="MailPlus" title="Invite students" subtitle="Upload a .txt of emails (one per line) or paste them. Each gets an email with a link to set their name + password." />}>
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
              { key: 'status', header: 'Status', width: '120px', render: (v, row) => (
                <AC.Badge tone={v === 'GRADED' ? 'success' : 'accent'} dot square>{v === 'GRADED' ? `Graded${row.grade != null ? ` · ${row.grade}` : ''}` : 'Submitted'}</AC.Badge>
              ) },
              { key: 'id', header: '', align: 'right', width: '100px', render: (_v, row) => (
                <AC.Button variant="secondary" size="sm" leadingIcon={<Icon name="PenLine" size={14} />} onClick={() => setGrading(row)}>Grade</AC.Button>
              ) },
            ]}
            rows={submissions}
          />
        )}
      </AC.Card>

      <GradeDialog submission={grading} onClose={() => setGrading(null)} onError={onError} />
    </div>
  );
}

function GradeDialog({ submission, onClose, onError }) {
  const [grade, setGrade] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  if (!submission) return null;

  const submit = async () => {
    setBusy(true);
    const res = await gradeSubmission(submission.id, Number(grade), feedback);
    setBusy(false);
    if (res?.error) { onError(res.error); return; }
    onClose();
  };

  return (
    <AC.Dialog
      open
      title={`Grade — ${submission.studentName}`}
      description={submission.scenarioTitle}
      icon={<Icon name="PenLine" size={18} />}
      onClose={onClose}
      footer={<>
        <AC.Button variant="ghost" onClick={onClose}>Cancel</AC.Button>
        <AC.Button variant="primary" loading={busy} onClick={submit}>Save grade</AC.Button>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {submission.flagReview?.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Flag answers</div>
            {submission.flagReview.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}>
                <Icon name={f.correct ? 'CircleCheck' : 'CircleX'} size={15} style={{ color: f.correct ? 'var(--status-success, #22c55e)' : 'var(--status-danger, #ef4444)', flex: 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{f.question}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{f.answer || '— no answer —'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {submission.report ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Report</div>
            <div style={{ maxHeight: 180, overflow: 'auto', padding: '10px 12px', borderRadius: 6, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', fontSize: 12.5, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{submission.report}</div>
          </div>
        ) : null}
        <AC.Input label="Grade (0–100)" type="number" min={0} max={100} value={grade} onChange={(e) => setGrade(e.target.value)} leadingIcon={<Icon name="Hash" size={16} />} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Feedback (optional)</label>
          <Textarea rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Notes for the student…" />
        </div>
      </div>
    </AC.Dialog>
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
