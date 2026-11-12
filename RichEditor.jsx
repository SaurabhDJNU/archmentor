import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import { Placeholder } from '@tiptap/extensions';
import * as api from './api.js';

const imageFiles = (list) => [...(list || [])].filter((f) => f.type.startsWith('image/'));

// Word-processor style editor. Paste or drop images straight into the text.
export default function RichEditor({ value = '', onChange, placeholder = 'Start writing…', compact = false, label = 'Text' }) {
  const editorRef = useRef(null);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(0);
  const [err, setErr] = useState('');

  const insertImages = async (files, pos) => {
    setErr('');
    for (const file of files) {
      setUploading((n) => n + 1);
      try {
        const src = await api.uploadImage(file);
        const ed = editorRef.current;
        if (!ed) return;
        const chain = ed.chain().focus();
        if (typeof pos === 'number') chain.insertContentAt(pos, { type: 'image', attrs: { src, alt: '' } }).run();
        else chain.setImage({ src, alt: '' }).run();
      } catch (e) { setErr(e.message); }
      finally { setUploading((n) => n - 1); }
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      Image.configure({ allowBase64: api.DEMO }),
      Youtube.configure({ nocookie: true, controls: true, modestBranding: true, width: 640, height: 360 }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: { class: `prose rich-area ${compact ? 'compact' : ''}`, 'aria-label': label, role: 'textbox', 'aria-multiline': 'true' },
      handlePaste: (_view, event) => {
        const files = imageFiles(event.clipboardData?.files);
        if (!files.length) return false;
        event.preventDefault();
        insertImages(files);
        return true;
      },
      handleDrop: (view, event) => {
        const files = imageFiles(event.dataTransfer?.files);
        if (!files.length) return false;
        event.preventDefault();
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
        insertImages(files, at?.pos);
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => onChange?.(ed.isEmpty ? '' : ed.getHTML()),
  });
  editorRef.current = editor;

  // Load new content when switching to a different story.
  useEffect(() => {
    if (editor && value !== undefined && editor.getHTML() !== value && !editor.isFocused) editor.commands.setContent(value || '', { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return null;
  const is = (name, attrs) => editor.isActive(name, attrs);
  const Btn = ({ on, active, children, title }) => (
    <button type="button" className="tb" aria-pressed={active ? 'true' : 'false'} title={title} aria-label={title} onMouseDown={(e) => e.preventDefault()} onClick={on}>{children}</button>
  );

  const addLink = () => {
    const prev = editor.getAttributes('link').href || '';
    const url = window.prompt('Link address (leave empty to remove the link)', prev || 'https://');
    if (url === null) return;
    if (!url || url === 'https://') editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };
  const addVideo = () => {
    const url = window.prompt('Paste a YouTube link');
    if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run();
  };

  return (
    <div className={`rich ${compact ? 'compact' : ''}`}>
      <div className="toolbar" role="toolbar" aria-label="Formatting">
        {!compact && <Btn title="Heading" on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={is('heading', { level: 2 })}>Heading</Btn>}
        {!compact && <Btn title="Subheading" on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={is('heading', { level: 3 })}>Subheading</Btn>}
        <span className="sep" aria-hidden="true" />
        <Btn title="Bold" on={() => editor.chain().focus().toggleBold().run()} active={is('bold')}><b>B</b></Btn>
        <Btn title="Italic" on={() => editor.chain().focus().toggleItalic().run()} active={is('italic')}><i>I</i></Btn>
        <Btn title="Link" on={addLink} active={is('link')}>Link</Btn>
        <span className="sep" aria-hidden="true" />
        <Btn title="Bulleted list" on={() => editor.chain().focus().toggleBulletList().run()} active={is('bulletList')}>• List</Btn>
        <Btn title="Numbered list" on={() => editor.chain().focus().toggleOrderedList().run()} active={is('orderedList')}>1. List</Btn>
        <Btn title="Quote" on={() => editor.chain().focus().toggleBlockquote().run()} active={is('blockquote')}>Quote</Btn>
        <span className="sep" aria-hidden="true" />
        <Btn title="Insert image" on={() => fileRef.current?.click()}>Image</Btn>
        {!compact && <Btn title="Insert YouTube video" on={addVideo}>YouTube</Btn>}
        {!compact && <Btn title="Divider line" on={() => editor.chain().focus().setHorizontalRule().run()}>Divider</Btn>}
        <span className="sep" aria-hidden="true" />
        <Btn title="Undo" on={() => editor.chain().focus().undo().run()}>Undo</Btn>
        <Btn title="Redo" on={() => editor.chain().focus().redo().run()}>Redo</Btn>
        {uploading > 0 && <span className="small muted" role="status" style={{ marginLeft: 8 }}>Uploading image…</span>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { insertImages(imageFiles(e.target.files)); e.target.value = ''; }} />
      <EditorContent editor={editor} />
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  );
}

export function wordCount(html = '') {
  return html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
}
