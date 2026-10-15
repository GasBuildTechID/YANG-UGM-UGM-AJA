'use client';

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

// Alur baru: pilihan -> cerita (voice AI) | lobby (relawan)
const NAV = [
  { href: '/app/voice', label: 'Cerita', icon: Sparkles },
  { href: '/app', label: 'Ringkasan', icon: Compass, exact: true },
  { href: '/app/lobby', label: 'Lobby', icon: DoorOpen },
  { href: '/app/account', label: 'Akun', icon: UserRound },
];

// Admin punya ruang kerjanya sendiri: dashboard operasional, bukan alur cerita.
// Menu user (Cerita/Ringkasan/Lobby) tidak ditampilkan supaya tidak tertukar.
const ADMIN_NAV = [
  { href: '/app/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/account', label: 'Akun', icon: UserRound },
];

export default function AppShell({ children }) {
  const { user, profile } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const isAdmin = profile?.role === 'admin';
  const nav = isAdmin ? ADMIN_NAV : NAV;
  const homeHref = isAdmin ? '/app/admin' : '/app/pilih';

  // Layar suara tampil imersif: tanpa header/nav/footer supaya hanya AI yang terlihat.
  // Dashboard admin juga imersif: dia membawa sidebar + top bar-nya sendiri.
  const immersive =
    (pathname?.startsWith('/app/voice') || pathname?.startsWith('/app/admin')) ?? false;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
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
          <Link href={homeHref} className="flex items-center gap-2 font-bold text-frost">
            <span className="logo-mark">🌿</span>
            <span>hearme</span>
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

        {/* nav bawah untuk layar kecil */}
        <nav className="flex items-center justify-around border-t border-white/5 bg-void/70 py-1 md:hidden">
          {nav.map((item) => {
            const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[11px] font-medium ${
                  active ? 'text-aurora-teal' : 'text-mist'
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
