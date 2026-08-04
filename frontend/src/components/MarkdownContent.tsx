import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

// Renders AI-generated markdown (summaries, chat replies) with the app's own
// typography instead of react-markdown's unstyled defaults or, worse, raw
// "**bold**" / "* item" text with no parsing at all.
export function MarkdownContent({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)}>
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => <h1 className="text-base font-bold text-gray-900 mt-3 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold text-gray-900 mt-3 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold text-gray-900 mt-2 first:mt-0">{children}</h3>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="bg-gray-100 text-gray-800 rounded px-1 py-0.5 text-[0.9em] font-mono">{children}</code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-gray-200 pl-3 text-gray-500 italic">{children}</blockquote>
          ),
          hr: () => <hr className="border-gray-200 my-3" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
