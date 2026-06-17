export function ContralyneLogoMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      {/* Center pole */}
      <path d="M16 8v16" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      {/* Crossbar */}
      <path d="M9 11h14" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      {/* Left chain */}
      <path d="M9 11v4" stroke="white" strokeWidth="1.25" strokeLinecap="round" />
      {/* Left pan (arc) */}
      <path d="M6 15 Q9 18 12 15" stroke="white" strokeWidth="1.25" strokeLinecap="round" />
      {/* Right chain */}
      <path d="M23 11v4" stroke="white" strokeWidth="1.25" strokeLinecap="round" />
      {/* Right pan (arc) */}
      <path d="M20 15 Q23 18 26 15" stroke="white" strokeWidth="1.25" strokeLinecap="round" />
      {/* Base */}
      <path d="M13 24h6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
