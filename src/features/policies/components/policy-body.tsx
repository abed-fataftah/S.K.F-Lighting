import type { ComponentProps } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";

// A policy page's body (spec 0025 AC-9): the owner's Arabic Markdown, CommonMark plus single line
// breaks (no GFM), drawn with an allow list. `#` and `##` become h2 (the page has its one h1),
// deeper headings h3; quotes and code are unwrapped to their text; images are dropped; raw HTML
// shows as typed. Links keep only https, mailto, tel, and same site paths. No `server-only`: the
// editor preview renders the same component. The plugin, the map, and `safeUrl` live here, since
// a function cannot be passed from a Server Component to a Client Component.

const ALLOWED = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "a",
  "br",
  "hr",
];

const SAFE_SCHEMES = ["https:", "mailto:", "tel:"];

/** The link target kept, or null to drop the link and keep its words. */
export function safeUrl(url: string): string | null {
  const target = url.trim();
  if (target.startsWith("/") && !target.startsWith("//") && !target.startsWith("/\\")) {
    return target;
  }
  const scheme = /^([a-z][a-z0-9+.-]*:)/i.exec(target)?.[1]?.toLowerCase();
  return scheme && SAFE_SCHEMES.includes(scheme) ? target : null;
}

type Node = { type: string; value?: string; children?: Node[] };

/** Raw HTML nodes become plain text, so `<b>` reads as `<b>` instead of being drawn or lost. */
function remarkHtmlAsText() {
  return (tree: Node) => {
    const visit = (node: Node) => {
      if (node.type === "html") node.type = "text";
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}

/** react-markdown hands each component its syntax tree `node`; it is not a DOM attribute. */
function domProps<P extends { node?: unknown }>(props: P): Omit<P, "node"> {
  const copy = { ...props };
  delete copy.node;
  return copy;
}

type WithNode<P> = P & { node?: unknown };

const heading2 = (props: WithNode<ComponentProps<"h2">>) => (
  <h2 className="mt-2 type-lead first:mt-0" {...domProps(props)} />
);
const heading3 = (props: WithNode<ComponentProps<"h3">>) => (
  <h3 className="mt-1 font-extrabold" {...domProps(props)} />
);

const components: Components = {
  h1: heading2,
  h2: heading2,
  h3: heading3,
  h4: heading3,
  h5: heading3,
  h6: heading3,
  ul: (props) => <ul className="list-disc ps-5" {...domProps(props)} />,
  ol: (props) => <ol className="list-decimal ps-5" {...domProps(props)} />,
  hr: (props) => <hr className="border-border" {...domProps(props)} />,
  a: ({ href, children, ...props }) =>
    href ? (
      <a
        href={href}
        className="underline underline-offset-4"
        rel={href.startsWith("https:") ? "noopener noreferrer" : undefined}
        {...domProps(props)}
      >
        {children}
      </a>
    ) : (
      <>{children}</>
    ),
};

export function PolicyBody({ markdown }: { readonly markdown: string }) {
  return (
    <div className="flex flex-col gap-2.5 type-body leading-(--lh-prose)" data-testid="policy-body">
      <Markdown
        remarkPlugins={[remarkBreaks, remarkHtmlAsText]}
        allowedElements={ALLOWED}
        unwrapDisallowed
        components={components}
        urlTransform={(url) => safeUrl(url)}
      >
        {markdown}
      </Markdown>
    </div>
  );
}
