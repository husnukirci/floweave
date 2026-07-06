// Markdown renderer for assistant chat messages (ADR-025). Renders to
// React elements — no innerHTML anywhere — and react-markdown ignores
// raw HTML in the content by default, so LLM output has no markup-
// injection surface. The components map is the single place chat
// typography lives, tuned for a 384px-wide panel: compact headings and
// lists, tables that scroll inside their own wrapper instead of blowing
// out the bubble, links hardened for opening third-party content.

import { memo, type JSX } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const REMARK_PLUGINS = [remarkGfm];

export const ChatMarkdown = memo(function ChatMarkdown({
  content,
}: {
  content: string;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <Markdown
        remarkPlugins={REMARK_PLUGINS}
        components={{
          h1: ({ children }) => <p className="font-semibold">{children}</p>,
          h2: ({ children }) => <p className="font-semibold">{children}</p>,
          h3: ({ children }) => <p className="font-semibold">{children}</p>,
          h4: ({ children }) => <p className="font-semibold">{children}</p>,
          h5: ({ children }) => <p className="font-semibold">{children}</p>,
          h6: ({ children }) => <p className="font-semibold">{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-0.5 pl-4">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-0.5 pl-4">{children}</ol>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 underline"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-neutral-200/60 px-1 py-0.5 font-mono text-[0.85em]">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded bg-neutral-200/60 p-2 text-xs">{children}</pre>
          ),
          hr: () => <hr className="border-neutral-200" />,
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-neutral-200 bg-neutral-50 px-2 py-1 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border border-neutral-200 px-2 py-1">{children}</td>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-neutral-300 pl-2 text-neutral-700">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
});
