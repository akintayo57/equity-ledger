import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Wallet, Settings, LogOut, TrendingUp } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ReloadPrompt } from './ReloadPrompt';
import { motion } from 'motion/react';
import { User } from 'firebase/auth';
import { auth, signOut } from '../firebase';
import { useStore } from '../store';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: 'Markets', path: '/', icon: TrendingUp },
  { name: 'Portfolio', path: '/portfolio', icon: Wallet },
];

export const Layout = ({ user }: { user: User }) => {
  const location = useLocation();
  const { theme } = useStore();

  // Scroll to top on route changes to prevent sticky layout overlap
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const isSettingsActive = location.pathname === '/settings';

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 pb-24 transition-colors duration-300">
      <header className="bg-slate-900/90 backdrop-blur-md text-white px-5 py-3 shadow-sm sticky top-0 z-20 border-b border-slate-800/20 dark:border-slate-800 flex justify-between items-center">
        <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
          Harbour Finance
        </h1>
        
        <div className="flex items-center gap-3">
          {user.photoURL ? (
            <img 
              src={user.photoURL} 
              alt={user.displayName || "User"} 
              className="w-7 h-7 rounded-full border border-slate-700 shadow-sm"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div 
              className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300"
              title={user.displayName || (user.isAnonymous ? "Local Workstation Session" : "Anonymous User")}
            >
              L
            </div>
          )}
          <Link
            to="/settings"
            className={cn(
              "p-1.5 hover:bg-slate-800 rounded-lg transition duration-150 cursor-pointer",
              isSettingsActive ? "text-blue-400" : "text-slate-400 hover:text-white"
            )}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
          <button 
            onClick={handleLogout}
            className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 rounded-lg transition duration-150 cursor-pointer"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto p-4 overflow-x-hidden">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 safe-area-pb z-30 shadow-lg transition-colors duration-300">
        <div className="flex justify-between items-center max-w-lg mx-auto px-3 relative">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  'relative flex flex-col items-center py-3.5 px-1.5 flex-1 text-[10px] font-semibold transition-colors z-10',
                  isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="navTabBackground"
                    className="absolute inset-x-1.5 inset-y-1.5 bg-blue-50/60 dark:bg-slate-800/60 rounded-xl -z-10"
                    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  />
                )}
                {isActive && (
                  <motion.div
                    layoutId="navTabActiveBar"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.75 bg-blue-600 dark:bg-blue-400 rounded-b-md"
                    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  />
                )}
                <Icon className={cn('w-5 h-5 mb-1.5', isActive ? 'stroke-[2.25]' : 'stroke-[1.75]')} />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* PWA Caching & Update Prompter */}
      <ReloadPrompt />
    </div>
  );
};
