/**
 * Glass folder (after kedhareswer's Glassmorphism Folder Cards on 21st.dev,
 * reimplemented in plain CSS): a tabbed back plate, a few sheets peeking out
 * that fan on hover, and a frosted front holding the content.
 */
export function Folder({
  sheets,
  className = "",
  inline = false,
  children,
}: {
  sheets: { title: string; meta?: string }[];
  className?: string;
  /** Render with spans so the folder can sit inside a button. */
  inline?: boolean;
  children: React.ReactNode;
}) {
  const Box = inline ? "span" : "div";
  return (
    <Box className={`folder ${className}`}>
      <span className="folder-back" aria-hidden="true" />
      {sheets.length > 0 && (
        <span className="folder-sheets" aria-hidden="true">
          {/* Back sheets are blank paper; only the front one is labelled. */}
          {sheets
            .slice(0, 3)
            .map((s, i, list) => ({ s, depth: list.length - 1 - i }))
            .map(({ s, depth }) => (
              <span
                className="folder-sheet"
                key={depth}
                style={{ "--i": depth } as React.CSSProperties}
              >
                {depth === 0 ? (
                  <>
                    <b>{s.title}</b>
                    {s.meta && <small>{s.meta}</small>}
                  </>
                ) : (
                  <i />
                )}
              </span>
            ))}
        </span>
      )}
      <Box className="folder-front">{children}</Box>
    </Box>
  );
}
