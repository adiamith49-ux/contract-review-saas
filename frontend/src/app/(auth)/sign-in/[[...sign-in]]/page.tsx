import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="w-full max-w-md space-y-3">
      <p className="text-center text-sm text-gray-500">
        Sign in with Gmail and password. Google and Facebook are optional.
      </p>
      <SignIn
        forceRedirectUrl="/dashboard"
        appearance={{
          layout: {
            socialButtonsPlacement: "bottom",
            socialButtonsVariant: "iconButton",
          },
        }}
      />
    </div>
  );
}
