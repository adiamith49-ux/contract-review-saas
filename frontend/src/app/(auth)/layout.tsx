export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/name-logo.png" alt="Contralyne — review, negotiate, red line, close" className="h-12 w-auto" />
      </div>
      {children}
      <p className="mt-8 text-xs text-gray-400 text-center max-w-sm">
        AI-generated insights are not legal advice. Always consult a qualified lawyer.
      </p>
    </div>
  );
}
