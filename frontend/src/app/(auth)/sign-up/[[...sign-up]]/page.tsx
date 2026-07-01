import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="w-full max-w-md space-y-3">
      <p className="text-center text-sm text-gray-500">
        Create your account with Gmail and password. Google and Facebook are optional.
      </p>
      <SignUp
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
