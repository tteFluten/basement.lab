import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getSupabase, hasSupabase } from "@/lib/supabase";

export const authOptions: NextAuthOptions = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        if (!hasSupabase()) return null;

        const supabase = getSupabase();
        const { data: row, error } = await supabase
          .from("users")
          .select("id, email, full_name, role, password_hash")
          .eq("email", credentials.email.trim().toLowerCase())
          .single();

        if (error || !row || !row.password_hash) return null;

        const ok = await bcrypt.compare(credentials.password, row.password_hash);
        if (!ok) return null;

        return {
          id: row.id,
          email: row.email,
          name: row.full_name ?? row.email,
          role: row.role ?? "member",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
};
