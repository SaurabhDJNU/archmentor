import DOMPurify from 'dompurify';
import Markdown from './Markdown.jsx';

// Only YouTube embeds are allowed through.
DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName === 'iframe') {
    const src = node.getAttribute('src') || '';
    if (!/^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com)\/embed\//.test(src)) node.parentNode?.removeChild(node);
  }
});
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('href')?.startsWith('http')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

const isHtml = (s = '') => /^\s*</.test(s);

// Renders a story or answer: HTML from the editor, or older markdown text.
export default function RichText({ text = '', className = 'prose', style }) {
  if (!isHtml(text)) return <div className={className} style={style}><Markdown text={text} /></div>;
  const clean = DOMPurify.sanitize(text, {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'target', 'data-youtube-video'],
  });
  return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: clean }} />;
}

export function plainText(text = '') {
  return text.replace(/<[^>]+>/g, ' ').replace(/[#>*_[\]()-]/g, ' ');
}
