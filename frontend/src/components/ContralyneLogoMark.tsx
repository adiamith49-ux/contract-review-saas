/* Contralyne "CL" logo mark (frontend/public/logo.png). The artwork is
   navy/teal on a transparent background — pass onDark to put a white tile
   behind it so it stays visible on dark surfaces. */
export function ContralyneLogoMark({ className, onDark }: { className?: string; onDark?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${
        onDark ? "rounded-md bg-white p-0.5" : ""
      } ${className ?? ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Contralyne" className="h-full w-full object-contain" />
    </span>
  );
}
