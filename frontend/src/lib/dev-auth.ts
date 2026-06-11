// Dev bypass — replace with real Clerk hooks when auth keys are ready
export function useAuth() {
  return {
    getToken: async () => "dev-token",
  };
}

export function useUser() {
  return {
    user: { firstName: "Dev" },
  };
}
