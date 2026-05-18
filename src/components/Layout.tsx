import { Outlet, Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ShieldCheck, LogOut, Sun, Moon } from 'lucide-react';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import { Logo } from './Logo';

export function Layout() {
  const [time, setTime] = useState(new Date());
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = time.toLocaleTimeString('en-LK', { 
    timeZone: 'Asia/Colombo', 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: true 
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex items-center space-x-3">
          <Link to="/" className="group">
            <Logo />
          </Link>
        </div>
        
        <div className="flex items-center space-x-4 md:space-x-6">
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm"
            aria-label="Toggle Theme"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          <div className="hidden md:flex items-center bg-brand-green/10 dark:bg-brand-green/20 px-3 py-1.5 rounded-full border border-brand-green/20 dark:border-brand-green/30">
            <span className="w-2 h-2 bg-brand-green rounded-full animate-pulse mr-2 shadow-[0_0_8px_var(--color-brand-green)]"></span>
            <span className="text-brand-green dark:text-brand-green text-xs font-semibold uppercase tracking-wider">System Online</span>
          </div>
          <div className="text-right border-l border-slate-200 dark:border-slate-700 pl-4 md:pl-6">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-tighter">Central Library</p>
            <p className="text-sm font-mono font-bold text-slate-700 dark:text-slate-200">{timeStr}</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="px-8 py-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 transition-colors">
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tracking-wide uppercase">© 2026 SeatIdle IoT Systems • v1.0.4-stable</p>
        <div className="flex items-center space-x-6">
          {user ? (
            <div className="flex items-center space-x-4">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">
                ID: {user.email?.split('@')[0]}
              </span>
              <button 
                onClick={() => auth.signOut()}
                className="text-[10px] font-bold text-red-500/70 hover:text-red-500 dark:text-red-400/70 dark:hover:text-red-400 uppercase tracking-widest flex items-center transition-colors px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10"
              >
                <LogOut className="w-3 h-3 mr-1.5" />
                Logout
              </button>
            </div>
          ) : (
            location.pathname !== '/admin' && (
              <Link to="/admin" className="text-[10px] font-bold text-brand-blue dark:text-brand-green uppercase tracking-widest flex items-center hover:opacity-80 transition-opacity">
                Admin Access
                <ShieldCheck className="w-3 h-3 ml-1" />
              </Link>
            )
          )}
        </div>
      </footer>
    </div>
  );
}
