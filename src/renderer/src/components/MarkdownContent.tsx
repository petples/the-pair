import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function MarkdownContent({ content }: { content: string }): React.ReactNode {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-lg font-bold">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-semibold">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold">{children}</h3>,
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-2 list-disc pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 list-decimal pl-5">{children}</ol>,
        li: ({ children }) => <li className="mb-1">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 border-border/70 pl-3 italic text-foreground/80">
            {children}
          </blockquote>
        ),
        code: ({ className, children }) => {
          const isBlock = className?.includes('language-')
          if (isBlock) {
            return (
              <code className="block overflow-x-auto rounded-lg border border-border/60 bg-background/70 p-3 font-mono text-[12px] leading-relaxed">
                {children}
              </code>
            )
          }
          return (
            <code className="rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[12px]">
              {children}
            </code>
          )
        },
        pre: ({ children }) => <pre className="my-2 overflow-x-auto">{children}</pre>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline decoration-primary/50 underline-offset-2"
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <table className="my-2 w-full border-collapse overflow-hidden rounded-lg text-[12px]">
            {children}
          </table>
        ),
        th: ({ children }) => (
          <th className="border border-border/60 bg-muted/50 px-2 py-1 text-left font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => <td className="border border-border/50 px-2 py-1">{children}</td>
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
