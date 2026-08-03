'use client';
import React, { useState, useTransition } from 'react';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { createStudent, resetStudentPassword, deleteStudent } from '@/app/actions/students';

/* Student Management surface. Data (the `students` list) comes from the server
   page; mutations go through Server Actions which revalidate the list. */
export function StudentsManager({ students }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [creating, startCreate] = useTransition();
  const [cred, setCred] = useState(null);      // { title, email, password }
  const [confirmDel, setConfirmDel] = useState(null); // student row
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  const openCreate = () => { setCreateError(null); setCreateOpen(true); };

  // Call the Server Action directly and handle the result in the submit handler
  // (no effect needed). The action revalidates the list server-side.
  const onCreateSubmit = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startCreate(async () => {
      const res = await createStudent({}, formData);
      if (res?.error) { setCreateError(res.error); return; }
      form.reset();
      setCreateError(null);
      setCreateOpen(false);
      setCred({ title: 'Student account created', ...res.created });
    });
  };

  const onReset = async (student) => {
    setError(null);
    setBusyId(student.id);
    const res = await resetStudentPassword(student.id);
    setBusyId(null);
    if (res?.error) setError(res.error);
    else setCred({ title: `New password for ${student.name}`, email: student.email, password: res.password });
  };

  const onDelete = async () => {
    const student = confirmDel;
    setConfirmDel(null);
    setError(null);
    setBusyId(student.id);
    const res = await deleteStudent(student.id);
    setBusyId(null);
    if (res?.error) setError(res.error);
  };

  const filtered = students.filter((s) => {
    const q = query.trim().toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  return (
    <div style={{ padding: 24, maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px' }}>Students</h2>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>
            {students.length} {students.length === 1 ? 'account' : 'accounts'} · provisioned by instructors
          </p>
        </div>
        <div style={{ width: 240 }}>
          <AC.Input size="sm" placeholder="Search name or email…" value={query} onChange={(e) => setQuery(e.target.value)} leadingIcon={<Icon name="Search" size={15} />} />
        </div>
        <AC.Button variant="primary" size="sm" leadingIcon={<Icon name="UserPlus" size={14} />} onClick={openCreate}>
          Add student
        </AC.Button>
      </div>

      {error && (
        <AC.Toast tone="danger" title="Something went wrong" message={error} onClose={() => setError(null)} />
      )}

      <AC.Card padded={false}>
        {filtered.length === 0 ? (
          <div style={{ padding: 8 }}>
            <AC.EmptyState
              icon={<Icon name="Users" size={24} />}
              title={students.length === 0 ? 'No students yet' : 'No matches'}
              description={students.length === 0 ? 'Add your first student to get them into the lab.' : 'Try a different search.'}
              actions={students.length === 0 ? <AC.Button variant="primary" size="sm" onClick={openCreate}>Add student</AC.Button> : null}
            />
          </div>
        ) : (
          <AC.Table
            rowKey="id"
            hover={false}
            columns={[
              { key: 'name', header: 'Name', primary: true },
              { key: 'email', header: 'Email', mono: true },
              { key: 'createdAt', header: 'Added', width: '130px', mono: true, render: (v) => new Date(v).toISOString().slice(0, 10) },
              {
                key: 'id', header: '', width: '210px', align: 'right',
                render: (_v, row) => (
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    <AC.Button variant="ghost" size="sm" loading={busyId === row.id} leadingIcon={<Icon name="KeyRound" size={14} />} onClick={() => onReset(row)}>
                      Reset
                    </AC.Button>
                    <AC.Button variant="outline-danger" size="sm" disabled={busyId === row.id} leadingIcon={<Icon name="Trash2" size={14} />} onClick={() => setConfirmDel(row)}>
                      Delete
                    </AC.Button>
                  </div>
                ),
              },
            ]}
            rows={filtered}
          />
        )}
      </AC.Card>

      {/* Create dialog */}
      <AC.Dialog
        open={createOpen}
        title="Add student"
        description="A strong password is generated automatically and shown once."
        icon={<Icon name="UserPlus" size={18} />}
        onClose={() => setCreateOpen(false)}
      >
        <form onSubmit={onCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <AC.Input label="Full name" name="name" placeholder="e.g. Amara Okafor" required leadingIcon={<Icon name="User" size={16} />} />
          <AC.Input label="Email" name="email" type="email" placeholder="student@zaio.io" required leadingIcon={<Icon name="Mail" size={16} />} />
          {createError && (
            <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--status-danger, #ef4444)' }}>
              <Icon name="TriangleAlert" size={15} /> {createError}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <AC.Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</AC.Button>
            <AC.Button type="submit" variant="primary" loading={creating} leadingIcon={<Icon name="UserPlus" size={14} />}>Create student</AC.Button>
          </div>
        </form>
      </AC.Dialog>

      {/* Generated-credentials dialog (create + reset). `key` resets the copied
          state whenever a new credential is revealed. */}
      <CredentialDialog key={cred ? cred.password : 'none'} cred={cred} onClose={() => setCred(null)} />

      {/* Delete confirm dialog */}
      <AC.Dialog
        open={!!confirmDel}
        title="Delete student?"
        description={confirmDel ? `${confirmDel.name} (${confirmDel.email}) will lose access immediately. This cannot be undone.` : ''}
        icon={<Icon name="Trash2" size={18} />}
        onClose={() => setConfirmDel(null)}
        footer={
          <>
            <AC.Button variant="ghost" onClick={() => setConfirmDel(null)}>Cancel</AC.Button>
            <AC.Button variant="danger" leadingIcon={<Icon name="Trash2" size={14} />} onClick={onDelete}>Delete student</AC.Button>
          </>
        }
      />
    </div>
  );
}

function CredentialDialog({ cred, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!cred) return null;

  const copy = async () => {
    try { await navigator.clipboard.writeText(cred.password); setCopied(true); } catch { /* clipboard blocked */ }
  };

  const field = (label, value, mono) => (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)', fontSize: 14, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{value}</div>
    </div>
  );

  return (
    <AC.Dialog
      open
      title={cred.title}
      description="Copy this password now — it is shown only once and cannot be recovered, only reset."
      icon={<Icon name="KeyRound" size={18} />}
      onClose={onClose}
      footer={
        <>
          <AC.Button variant="secondary" leadingIcon={<Icon name={copied ? 'Check' : 'Copy'} size={14} />} onClick={copy}>
            {copied ? 'Copied' : 'Copy password'}
          </AC.Button>
          <AC.Button variant="primary" onClick={onClose}>Done</AC.Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-inset)', border: '1px solid var(--border-default)' }}>
        {field('Email', cred.email, true)}
        {field('Password', cred.password, true)}
      </div>
    </AC.Dialog>
  );
}

export default StudentsManager;
