import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Auth.js v5, JWT sessions only.
 *
 * There is deliberately no database adapter: signing in must not write an
 * identity row anywhere. The Google subject identifier is the key material for
 * the delegation vault, so it is kept in the encrypted session cookie (`gsub`)
 * and nowhere else.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    async jwt({ token, account }) {
      if (account?.providerAccountId) token.gsub = account.providerAccountId;
      return token;
    },
    async session({ session }) {
      // Deliberately does NOT copy `gsub` onto the session. Whatever this
      // returns is served verbatim at /api/auth/session, which is readable by
      // any script on the page; `gsub` is the vault key and must stay inside
      // the encrypted cookie. Server code reads it via lib/session.ts instead.
      return session;
    },
  },
});
