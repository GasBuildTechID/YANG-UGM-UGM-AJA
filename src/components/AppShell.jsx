'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Compass,
  DoorOpen,
  LayoutDashboard,
  LogOut,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/components/SessionProvider';
import SupabaseConfigBanner from '@/components/SupabaseConfigBanner';
import Logo from '@/components/Logo';

const USER_NAV = [
  { href: '/app/voice', label: 'Cerita', icon: Sparkles },
  { href: '/app', label: 'Ringkasan', icon: Compass, exact: true },
  { href: '/app/account', label: 'Akun', icon: UserRound },
];

const ADMIN_NAV = [
  { href: '/app/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/account', label: 'Akun', icon: UserRound },
];

export default function AppShell({ children }) {
  const { user, profile } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [isVolunteerApproved, setIsVolunteerApproved] = useState(false);

  const isAdmin = profile?.role === 'admin';
  const homeHref = isAdmin ? '/app/admin' : '/app/voice';

  useEffect(() => {
    if (!user || isAdmin) return;
    supabase
      .from('volunteer_applications')
      .select('status')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .maybeSingle()
      .then(({ data }) => {
        setIsVolunteerApproved(Boolean(data));
      });
  }, [user, isAdmin]);

  const nav = isAdmin
    ? ADMIN_NAV
    : isVolunteerApproved
      ? [
          { href: '/app/voice', label: 'Cerita', icon: Sparkles },
          { href: '/app', label: 'Ringkasan', icon: Compass, exact: true },
          { href: '/app/lobby', label: 'Lobby', icon: DoorOpen },
          { href: '/app/account', label: 'Akun', icon: UserRound },
        ]
      : USER_NAV;

  // Layar suara tampil imersif: tanpa header/nav/footer supaya hanya AI yang terlihat.
  // Dashboard admin juga imersif: dia membawa sidebar + top bar-nya sendiri.
  const immersive =
    (pathname?.startsWith('/app/voice') || pathname?.startsWith('/app/admin')) ?? false;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  if (immersive) {
    return (
      <main className="relative">
        <SupabaseConfigBanner />
        {children}
      </main>
    );
  }

  return (
    <div className="min-h-dvh">
      <SupabaseConfigBanner />
      <header className="sticky top-0 z-30 border-b border-white/8 bg-void/60 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href={homeHref} className="flex items-center gap-2.5 font-bold text-frost">
            <Logo size={32} />
            <span className="text-base tracking-tight">hearme</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => {
              const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition ${
                    active
                      ? 'border border-indigo-300/25 bg-indigo-300/10 text-frost'
                      : 'border border-transparent text-fog hover:bg-white/5 hover:text-frost'
                  }`}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-mist sm:block">{profile?.display_name || user?.email || ''}</span>
            <button type="button" onClick={handleLogout} className="btn-ghost" title="Keluar">
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Konten utama dengan padding bawah ekstra untuk mobile bar */}
      <main className="mx-auto max-w-5xl px-3.5 pb-24 pt-5 sm:px-4 sm:py-6">{children}</main>

      {/* Navigasi bawah tetap (fixed bottom bar) untuk layar mobile (320px - 768px) */}
      <nav
        aria-label="Navigasi bawah mobile"
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-hairline/80 bg-paper/95 py-2.5 backdrop-blur-lg md:hidden"
        style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom, 0px))' }}
      >
        {nav.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-4 py-1.5 text-xs font-medium transition ${
                active ? 'bg-black/5 text-ink font-semibold' : 'text-body hover:text-ink'
              }`}
            >
              <Icon className="size-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
