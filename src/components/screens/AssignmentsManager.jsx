'use client';
import React, { useState, useMemo, useTransition } from 'react';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { assignScenario, unassignScenario } from '@/app/actions/assignments';

const STATUS_META = {
  ASSIGNED: { tone: 'brand', label: 'Assigned' },
  IN_PROGRESS: { tone: 'accent', label: 'In progress' },
  COMPLETED: { tone: 'success', label: 'Completed' },
};

/* Assignment Scenarios: browse the scenario catalog and assign scenarios to
   students. Data comes from the server page; mutations are Server Actions that
   revalidate this route. */
export function AssignmentsManager({ scenarios, students, assignments }) {
  const [assignFor, setAssignFor] = useState(null); // scenario being assigned
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null); // assignment id being removed

  // scenarioId -> assignment rows
  const byScenario = useMemo(() => {
    const map = {};
    for (const a of assignments) (map[a.scenarioId] ||= []).push(a);
    return map;
  }, [assignments]);

  const onRemove = async (assignment) => {
    setError(null);
    setBusyId(assignment.id);
    const res = await unassignScenario(assignment.id);
    setBusyId(null);
    if (res?.error) setError(res.error);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1120, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px' }}>Assignment Scenarios</h2>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>
            {scenarios.length} scenarios · {students.length} {students.length === 1 ? 'student' : 'students'} · {assignments.length} active {assignments.length === 1 ? 'assignment' : 'assignments'}
          </p>
        </div>
      </div>

      {error && <AC.Toast tone="danger" title="Something went wrong" message={error} onClose={() => setError(null)} />}

      {students.length === 0 && (
        <AC.Card>
          <AC.EmptyState
            icon={<Icon name="Users" size={24} />}
            title="No students to assign yet"
            description="Add students on the Students page before assigning scenarios."
          />
        </AC.Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
        {scenarios.map((sc) => {
          const rows = byScenario[sc.id] || [];
          return (
            <AC.Card key={sc.id} accent={sc.color === 'critical'}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 200 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <AC.SeverityBadge level={sc.color} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-tertiary)' }}>{sc.id}</span>
                    </div>
                    <h3 style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>{sc.title}</h3>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <AC.Badge tone="neutral" square>{sc.difficulty}</AC.Badge>
                  <AC.Badge tone="neutral" square icon={<Icon name="Clock" size={11} />}>{sc.mins}m</AC.Badge>
                  <AC.Badge tone="neutral" square>{sc.tag}</AC.Badge>
                </div>

                <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, flex: 1 }}>{sc.desc}</p>

                {/* Assigned students */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: rows.length ? 8 : 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                      {rows.length ? `Assigned · ${rows.length}` : 'Not assigned'}
                    </span>
                    <AC.Button variant="secondary" size="sm" leadingIcon={<Icon name="UserPlus" size={13} />} disabled={students.length === 0} onClick={() => setAssignFor(sc)}>
                      Assign
                    </AC.Button>
                  </div>
                  {rows.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {rows.map((a) => (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <AC.Avatar name={a.student.name} size="sm" />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.student.name}</div>
                          </div>
                          <AC.Badge tone={STATUS_META[a.status].tone} dot square>{STATUS_META[a.status].label}</AC.Badge>
                          <AC.IconButton label="Unassign" onClick={() => onRemove(a)} disabled={busyId === a.id}>
                            <Icon name="X" size={14} />
                          </AC.IconButton>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </AC.Card>
          );
        })}
      </div>

      <AssignDialog
        key={assignFor ? assignFor.id : 'none'}
        scenario={assignFor}
        students={students}
        assignedIds={assignFor ? new Set((byScenario[assignFor.id] || []).map((a) => a.student.id)) : new Set()}
        onClose={() => setAssignFor(null)}
        onError={setError}
      />
    </div>
  );
}

function AssignDialog({ scenario, students, assignedIds, onClose, onError }) {
  const [selected, setSelected] = useState(() => new Set());
  const [due, setDue] = useState('');
  const [pending, startTransition] = useTransition();
  if (!scenario) return null;

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const assignable = students.filter((s) => !assignedIds.has(s.id));

  const submit = () => {
    if (selected.size === 0) { onError('Select at least one student.'); return; }
    startTransition(async () => {
      const res = await assignScenario(scenario.id, [...selected], due || null);
      if (res?.error) { onError(res.error); return; }
      onClose();
    });
  };

  return (
    <AC.Dialog
      open
      title={`Assign · ${scenario.title}`}
      description="Select the students who should receive this scenario."
      icon={<Icon name="ClipboardList" size={18} />}
      onClose={onClose}
      footer={
        <>
          <AC.Button variant="ghost" onClick={onClose}>Cancel</AC.Button>
          <AC.Button variant="primary" loading={pending} leadingIcon={<Icon name="Check" size={14} />} onClick={submit}>
            Assign{selected.size ? ` (${selected.size})` : ''}
          </AC.Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ maxHeight: 260, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: 8 }}>
          {students.map((s) => {
            const already = assignedIds.has(s.id);
            return (
              <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 6, cursor: already ? 'default' : 'pointer', opacity: already ? 0.55 : 1 }}>
                <AC.Checkbox checked={already || selected.has(s.id)} disabled={already} onChange={() => toggle(s.id)} />
                <AC.Avatar name={s.name} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{s.email}</div>
                </div>
                {already && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Already assigned</span>}
              </label>
            );
          })}
        </div>
        {assignable.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Every student already has this scenario.</div>
        )}
        <AC.Input label="Due date (optional)" type="date" value={due} onChange={(e) => setDue(e.target.value)} leadingIcon={<Icon name="CalendarClock" size={16} />} />
      </div>
    </AC.Dialog>
  );
}

export default AssignmentsManager;
