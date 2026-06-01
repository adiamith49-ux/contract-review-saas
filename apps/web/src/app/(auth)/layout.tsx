import { Scale } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="mb-8 flex items-center gap-2">
        <Scale className="h-8 w-8 text-primary" />
        <span className="text-2xl font-bold tracking-tight text-gray-900">Contralyn</span>
      </div>
      {children}
      <p className="mt-8 text-xs text-gray-400 text-center max-w-sm">
        AI-generated insights are not legal advice. Always consult a qualified lawyer.
      </p>
    </div>
  );
}
