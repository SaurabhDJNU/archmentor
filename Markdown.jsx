// Tiny, safe markdown renderer for Journal posts and answers.
// Supports: ## and ### headings, paragraphs, - / 1. lists, > quotes, **bold**, *italic*, [text](https://link)
import { Fragment } from 'react';

function inline(text, keyBase) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0; let m; let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${keyBase}-${i++}`;
    if (t.startsWith('**')) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('*')) out.push(<em key={k}>{t.slice(1, -1)}</em>);
    else {
      const label = t.slice(1, t.indexOf(']'));
      out.push(<a key={k} href={m[2]} target="_blank" rel="noopener noreferrer">{label}</a>);
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Markdown({ text = '' }) {
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        if (b.startsWith('### ')) return <h3 key={i}>{inline(b.slice(4), i)}</h3>;
        if (b.startsWith('## ')) return <h2 key={i}>{inline(b.slice(3), i)}</h2>;
        if (lines.every((l) => l.startsWith('> '))) return <blockquote key={i}>{inline(lines.map((l) => l.slice(2)).join(' '), i)}</blockquote>;
        if (lines.every((l) => /^[-*] /.test(l))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.slice(2), `${i}-${j}`)}</li>)}</ul>;
        if (lines.every((l) => /^\d+\. /.test(l))) return <ol key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\d+\. /, ''), `${i}-${j}`)}</li>)}</ol>;
        return <p key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l, `${i}-${j}`)}</Fragment>)}</p>;
      })}
    </>
  );
}
