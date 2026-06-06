import { ReactNode } from 'react';
import { cn } from '../Layout';

export const Card = ({ children, className }: { children: ReactNode; className?: string; key?: any }) => (
  <div className={cn('bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100/90 dark:border-slate-800/80 overflow-hidden hover:shadow-md hover:border-slate-200/50 dark:hover:border-slate-700/50 transition-all duration-300', className)}>
    {children}
  </div>
);

export const CardHeader = ({ title, action }: { title: ReactNode; action?: ReactNode }) => (
  <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-850 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/20 backdrop-blur-xs">
    <h3 className="font-bold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-widest">{title}</h3>
    {action}
  </div>
);

export const CardContent = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('p-5', className)}>
    {children}
  </div>
);

export const StatBox = ({ label, value, subLabel, valueClass }: { label: string; value: string | ReactNode; subLabel?: string | ReactNode; valueClass?: string }) => (
  <div className="flex flex-col">
    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1.5">{label}</span>
    <span className={cn('text-xl font-extrabold text-slate-900 dark:text-white tracking-tight', valueClass)}>{value}</span>
    {subLabel && <span className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subLabel}</span>}
  </div>
);

export const Badge = ({ children, variant = 'gray' }: { children: ReactNode; variant?: 'gray' | 'red' | 'yellow' | 'green' | 'blue' }) => {
  const variants = {
    gray: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/10 dark:border-slate-500/20',
    red: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/10 dark:border-rose-500/20',
    yellow: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/10 dark:border-amber-500/20',
    green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border-emerald-500/10 dark:border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/10 dark:border-blue-500/20',
  };
  return (
    <span className={cn('px-2.5 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider border', variants[variant])}>
      {children}
    </span>
  );
};
