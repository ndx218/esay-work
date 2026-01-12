// pages/_app.tsx
import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';
import SessionCreditsHydrator from '@/components/SessionCreditsHydrator';
import '@/styles/globals.css';

export default function MyApp({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  return (
    <SessionProvider session={session}>
      <SessionCreditsHydrator />
      
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700" style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
        backgroundAttachment: 'fixed'
      }}>
        <Component {...pageProps} />
      </div>

      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
    </SessionProvider>
  );
}
