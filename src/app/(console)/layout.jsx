'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';

/* Authenticated console shell. This is a mock gate for the simulation:
   auth state lives in localStorage (set by the login screen). Swap this for
   a real session check when wiring server-side auth with the Argon2 helpers
   in src/lib/password.ts. */
export default function ConsoleLayout({ children }) {
  const router = useRouter();
  const [authed, setAuthed] = useState(null); // null = still checking

  useEffect(() => {
    const ok = typeof window !== 'undefined' && localStorage.getItem('athena.auth') === '1';
    if (!ok) router.replace('/login');
    else setAuthed(true);
  }, [router]);

  if (!authed) return null; // avoid a flash of the shell before the gate resolves
  return <AppShell>{children}</AppShell>;
}
