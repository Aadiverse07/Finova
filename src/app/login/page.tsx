import { redirect } from 'next/navigation';

// All QuikIT apps use `/login` (not `/auth/login`) and never render their own credentials form:
// sign-in happens on the central auth host (NEXT_PUBLIC_AUTH_URL).
export default function LoginPage() {
  const authUrl = process.env.NEXT_PUBLIC_AUTH_URL;
  if (authUrl) redirect(`${authUrl.replace(/\/$/, '')}/login`);
  return (
    <main className="mx-auto max-w-md p-10">
      <h1 className="text-xl font-semibold">Sign-in is not configured</h1>
      <p className="mt-2 text-sm text-slate-500">
        Set NEXT_PUBLIC_AUTH_URL to the QuikIT central auth host (http://localhost:3001 in development).
      </p>
    </main>
  );
}
