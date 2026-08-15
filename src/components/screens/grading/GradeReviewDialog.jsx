'use client';
import React, { useState } from 'react';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { gradeSubmission, setGradeReleased } from '@/app/actions/grading';
import { RichTextEditor } from '@/components/RichText';

/* Review a student's submission: see flag correctness + report, set/amend a
   grade + feedback, then release it to the student (or hold it). Shared by the
   cross-cohort grading queue and the per-cohort grading tab. Key this by the
   submission id at the call site so it re-initialises per submission. */
export function GradeReviewDialog({ submission, onClose, onError, onDone }) {
  const [grade, setGrade] = useState(submission?.grade != null ? String(submission.grade) : '');
  const [feedback, setFeedback] = useState(submission?.feedback || '');
  const [busy, setBusy] = useState(false);
  if (!submission) return null;

  const released = submission.released;
  const graded = submission.status === 'GRADED';
  const finish = () => { onDone?.(); onClose(); };

  const commit = async (release) => {
    setBusy(true);
    const res = await gradeSubmission(submission.id, Number(grade), feedback, release);
    setBusy(false);
    if (res?.error) { onError?.(res.error); return; }
    finish();
  };
  const toggleRelease = async (next) => {
    setBusy(true);
    const res = await setGradeReleased(submission.id, next);
    setBusy(false);
    if (res?.error) { onError?.(res.error); return; }
    finish();
  };

  return (
    <AC.Dialog
      open
      size="lg"
      title={`Review — ${submission.studentName}`}
      description={`${submission.scenarioTitle}${submission.cohortName ? ` · ${submission.cohortName}` : ''}`}
      icon={<Icon name="PenLine" size={18} />}
      onClose={onClose}
      footer={<>
        <AC.Button variant="ghost" onClick={onClose}>Cancel</AC.Button>
        {graded && released && (
          <AC.Button variant="secondary" loading={busy} leadingIcon={<Icon name="EyeOff" size={14} />} onClick={() => toggleRelease(false)}>Hold</AC.Button>
        )}
        <AC.Button variant="secondary" loading={busy} onClick={() => commit(false)}>Save (hold)</AC.Button>
        <AC.Button variant="primary" loading={busy} leadingIcon={<Icon name="Send" size={14} />} onClick={() => commit(true)}>{released ? 'Save & keep released' : 'Save & release'}</AC.Button>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-tertiary)' }}>
          <Icon name={released ? 'Eye' : 'EyeOff'} size={14} />
          {released ? 'Released — the student can see this grade.' : graded ? 'Graded but held — the student cannot see it yet.' : 'Not graded yet — the student sees “awaiting grading”.'}
        </div>

        {submission.flagReview?.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
              Flag answers · {submission.flagReview.filter((f) => f.correct).length}/{submission.flagReview.length} correct
            </div>
            {submission.flagReview.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}>
                <Icon name={f.correct ? 'CircleCheck' : 'CircleX'} size={15} style={{ color: f.correct ? 'var(--status-success, #22c55e)' : 'var(--status-danger, #ef4444)', flex: 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{f.question}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{f.answer || '— no answer —'}</div>
                </div>
                {f.points ? <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{f.points}p</span> : null}
              </div>
            ))}
          </div>
        )}

        {(submission.report || submission.reportFileName) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Report</div>
            {submission.reportFileName && (
              <a href={`/api/submissions/${submission.id}/report`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 6, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}>
                  <Icon name="FileText" size={16} style={{ color: 'var(--accent, #7c8cff)', flex: 'none' }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{submission.reportFileName}</span>
                  <Icon name="Download" size={15} style={{ color: 'var(--text-tertiary)', flex: 'none' }} />
                </div>
              </a>
            )}
            {submission.report && (
              <div style={{ maxHeight: 200, overflow: 'auto', padding: '10px 12px', borderRadius: 6, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', fontSize: 12.5, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{submission.report}</div>
            )}
          </div>
        )}

        <AC.Input label="Grade (0–100)" type="number" min={0} max={100} value={grade} onChange={(e) => setGrade(e.target.value)} leadingIcon={<Icon name="Hash" size={16} />} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Feedback {released ? '(updates what the student sees)' : '(shown to the student on release)'}</label>
          <RichTextEditor value={feedback} onChange={setFeedback} />
        </div>
      </div>
    </AC.Dialog>
  );
}

export default GradeReviewDialog;
