'use client';
import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Icon } from '@/components/Icon';

/* Lightweight rich-text editor (TipTap/StarterKit) + a matching HTML renderer.
   Used for instructor feedback: authored as formatted text, stored as HTML in
   Submission.feedback, and rendered back to the student. Authors are trusted
   instructors (SUPER_ADMIN); StarterKit's schema only permits safe tags. */
const CSS = `
.rte{border:1px solid var(--border-default);border-radius:var(--radius-sm);background:var(--surface-inset);overflow:hidden;}
.rte-bar{display:flex;flex-wrap:wrap;gap:2px;padding:6px;border-bottom:1px solid var(--border-subtle);background:var(--surface-panel);}
.rte-btn{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border:none;background:transparent;border-radius:6px;color:var(--text-tertiary);cursor:pointer;}
.rte-btn:hover{background:var(--surface-hover);color:var(--text-secondary);}
.rte-btn--on{background:var(--accent-subtle-bg);color:var(--accent);}
.rte-sep{width:1px;align-self:stretch;margin:3px 4px;background:var(--border-subtle);}
.rte-content{min-height:120px;max-height:300px;overflow:auto;padding:11px 13px;font-size:13.5px;line-height:1.6;color:var(--text-primary);outline:none;}
.rte-content:focus{outline:none;}
.rte-content p{margin:0 0 8px;}
.rte-content p:last-child{margin-bottom:0;}
.rte-rendered,.rte-content{word-break:break-word;}
.rte-rendered{font-size:13px;line-height:1.6;color:var(--text-secondary);}
.rte-rendered p{margin:0 0 8px;} .rte-rendered p:last-child{margin-bottom:0;}
.rte-rendered h2{font-size:15px;} .rte-rendered h3{font-size:14px;}
.rte-rendered h2,.rte-rendered h3{font-weight:600;color:var(--text-primary);margin:10px 0 6px;}
.rte-rendered ul,.rte-rendered ol,.rte-content ul,.rte-content ol{margin:0 0 8px;padding-left:20px;}
.rte-rendered li,.rte-content li{margin:2px 0;}
.rte-rendered blockquote,.rte-content blockquote{margin:0 0 8px;padding-left:12px;border-left:3px solid var(--border-strong);color:var(--text-tertiary);}
.rte-rendered code,.rte-content code{font-family:var(--font-mono);font-size:0.88em;background:var(--surface-inset);border:1px solid var(--border-subtle);border-radius:4px;padding:1px 4px;}
.rte-rendered strong,.rte-content strong{color:var(--text-primary);}
`;

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-ath', 'rte');
  s.textContent = CSS;
  document.head.appendChild(s);
}

function Btn({ active, onClick, icon, label }) {
  return (
    <button type="button" title={label} aria-label={label} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className={'rte-btn' + (active ? ' rte-btn--on' : '')}>
      <Icon name={icon} size={15} />
    </button>
  );
}

export function RichTextEditor({ value, onChange }) {
  inject();
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    immediatelyRender: false,
    editorProps: { attributes: { class: 'rte-content' } },
    onUpdate: ({ editor }) => onChange(editor.getText().trim() ? editor.getHTML() : ''),
  });

  if (!editor) return <div className="rte" style={{ minHeight: 150 }} />;

  const c = () => editor.chain().focus();
  return (
    <div className="rte">
      <div className="rte-bar">
        <Btn label="Bold" icon="Bold" active={editor.isActive('bold')} onClick={() => c().toggleBold().run()} />
        <Btn label="Italic" icon="Italic" active={editor.isActive('italic')} onClick={() => c().toggleItalic().run()} />
        <Btn label="Strikethrough" icon="Strikethrough" active={editor.isActive('strike')} onClick={() => c().toggleStrike().run()} />
        <span className="rte-sep" />
        <Btn label="Heading" icon="Heading2" active={editor.isActive('heading', { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()} />
        <Btn label="Bullet list" icon="List" active={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()} />
        <Btn label="Numbered list" icon="ListOrdered" active={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()} />
        <Btn label="Quote" icon="Quote" active={editor.isActive('blockquote')} onClick={() => c().toggleBlockquote().run()} />
        <Btn label="Inline code" icon="Code" active={editor.isActive('code')} onClick={() => c().toggleCode().run()} />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

/** Render stored feedback HTML. Falls back to plain text (older feedback). */
export function RichText({ html, className = '' }) {
  inject();
  if (!html) return null;
  return <div className={`rte-rendered ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export default RichTextEditor;
