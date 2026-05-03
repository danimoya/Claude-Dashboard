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
        // Body
        'text-[14px] leading-[1.65] text-foreground',
        // Spacing between block elements
        '[&>*+*]:mt-3',
        // Headings
        '[&_h1]:text-xl [&_h1]:font-semibold [&_h1]:mt-5 [&_h1]:mb-2 [&_h1]:tracking-tight',
        '[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-1.5 [&_h2]:tracking-tight',
        '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1',
        '[&_h4]:text-[15px] [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-1',
        '[&_h5]:text-sm [&_h5]:font-semibold [&_h5]:mt-2 [&_h5]:mb-1 [&_h5]:uppercase [&_h5]:tracking-wide [&_h5]:text-muted-foreground',
        // Inline text
        '[&_strong]:font-semibold [&_em]:italic',
        '[&_a]:text-primary [&_a]:underline [&_a]:decoration-primary/40 [&_a:hover]:decoration-primary',
        '[&_kbd]:font-mono [&_kbd]:text-[11px] [&_kbd]:px-1.5 [&_kbd]:py-0.5 [&_kbd]:rounded [&_kbd]:bg-muted [&_kbd]:border [&_kbd]:border-border',
        // Paragraphs
        '[&_p]:my-0',
        // Lists
        '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
        '[&_li]:my-1 [&_li>p]:m-0 [&_li>ul]:mt-1 [&_li>ol]:mt-1',
        // Blockquote
        '[&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground',
        // Inline code
        '[&_code]:font-mono [&_code]:text-[12.5px] [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:border [&_code]:border-border',
        // Code blocks (override inline rules)
        '[&_pre]:bg-zinc-950 [&_pre]:dark:bg-zinc-900 [&_pre]:text-zinc-100 [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-zinc-800 [&_pre]:text-[12.5px] [&_pre]:leading-relaxed',
        '[&_pre>code]:bg-transparent [&_pre>code]:p-0 [&_pre>code]:border-0 [&_pre>code]:text-zinc-100',
        // Tables
        '[&_table]:w-full [&_table]:border-collapse [&_table]:text-[13px]',
        '[&_th]:text-left [&_th]:font-semibold [&_th]:px-3 [&_th]:py-1.5 [&_th]:border-b [&_th]:border-border [&_th]:bg-muted/30',
        '[&_td]:px-3 [&_td]:py-1.5 [&_td]:border-b [&_td]:border-border',
        // Horizontal rule
        '[&_hr]:my-4 [&_hr]:border-border',
        // Images
        '[&_img]:max-w-full [&_img]:rounded',
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
