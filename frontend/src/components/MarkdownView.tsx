/**
 * MarkdownView
 * Render markdown with HTML pass-through, sanitized via DOMPurify.
 */

import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { clsx } from 'clsx';

interface MarkdownViewProps {
  source: string;
  className?: string;
}

const renderer = new marked.Renderer();
// Force links to open in a new tab and strip javascript: URIs (DOMPurify
// will catch the rest).
renderer.link = ({ href, title, tokens }) => {
  const text = (renderer as any).parser?.parseInline(tokens) || '';
  const safeHref = (href || '').toString();
  if (/^\s*javascript:/i.test(safeHref)) return text;
  const t = title ? ` title="${title.replace(/"/g, '&quot;')}"` : '';
  return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer"${t}>${text}</a>`;
};

marked.setOptions({
  gfm: true,
  breaks: true,
  renderer,
});

export default function MarkdownView({ source, className }: MarkdownViewProps) {
  const html = useMemo(() => {
    try {
      const raw = marked.parse(source || '', { async: false }) as string;
      return DOMPurify.sanitize(raw, {
        ALLOWED_TAGS: [
          'a', 'b', 'br', 'blockquote', 'code', 'del', 'em', 'h1', 'h2', 'h3',
          'h4', 'h5', 'h6', 'hr', 'i', 'img', 'kbd', 'li', 'ol', 'p', 'pre',
          'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'th', 'thead',
          'tr', 'ul',
        ],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel'],
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'style'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick'],
      });
    } catch {
      // Fallback to plain text on any parser error
      return DOMPurify.sanitize(`<pre>${escapeHtml(source || '')}</pre>`);
    }
  }, [source]);

  return (
    <div
      className={clsx(
        'prose prose-sm dark:prose-invert max-w-none',
        '[&_pre]:bg-zinc-900 [&_pre]:text-zinc-100 [&_pre]:rounded [&_pre]:p-2 [&_pre]:overflow-x-auto',
        '[&_code]:font-mono [&_code]:text-[12.5px]',
        '[&_a]:text-primary [&_a:hover]:underline',
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
