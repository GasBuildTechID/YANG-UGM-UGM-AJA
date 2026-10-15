import './globals.css';
import { SessionProvider } from '@/components/SessionProvider';
import AuroraBackground from '@/components/AuroraBackground';

export const metadata = {
  title: 'hearme — Ruang aman malam hari',
  description:
    'Ruang aman malam hari untuk mahasiswa: ceritakan isi kepalamu, lalu ubah jadi karya.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#fbfaf8',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh">
        <AuroraBackground />
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
