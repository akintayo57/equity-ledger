import { auth, googleProvider, signInWithPopup, signInAnonymously } from '../firebase';
import { useState } from 'react';

export function Login() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInAnonymously(auth);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to sign in as guest.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-slate-900 via-slate-950 to-black text-white p-4">
      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow circles */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col items-center text-center">
          {/* Logo */}
          <div className="h-16 w-16 bg-gradient-to-tr from-blue-500 via-indigo-500 to-violet-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-6">
            <span className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-blue-100">
              H
            </span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400 mb-2">
            Harbour Finance
          </h1>
          <p className="text-slate-400 text-sm max-w-xs mb-8">
            Caribbean stock portfolio tracker and investment ledger. Sign in to sync your portfolios and watchlists.
          </p>

          {error && (
            <div className="w-full bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-6 text-sm text-red-400 text-left">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-white hover:bg-slate-100 text-black font-semibold h-12 px-6 rounded-xl flex items-center justify-center gap-3 transition-all duration-200 shadow-md shadow-white/5 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Continue with Google
          </button>

          <button
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full mt-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold h-12 px-6 rounded-xl flex items-center justify-center gap-3 transition-all duration-200 shadow-md active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            Continue as Guest / Developer
          </button>
        </div>
      </div>
    </div>
  );
}
