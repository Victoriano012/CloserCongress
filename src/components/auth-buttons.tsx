import { signIn, signOut } from "@/auth";

const PRIMARY =
  "rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800";
const SECONDARY =
  "rounded-md border border-blue-200 px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-50";

export function SignInButton({ children = "Sign in with Google" }: { children?: React.ReactNode }) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google");
      }}
    >
      <button type="submit" className={PRIMARY}>
        {children}
      </button>
    </form>
  );
}

export function SignOutButton({ children = "Sign out" }: { children?: React.ReactNode }) {
  return (
    <form
      action={async () => {
        "use server";
        await signOut();
      }}
    >
      <button type="submit" className={SECONDARY}>
        {children}
      </button>
    </form>
  );
}
