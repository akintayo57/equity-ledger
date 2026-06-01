import { ReactNode } from 'react';
import { cn } from '../Layout';

export const Card = ({ children, className }: { children: ReactNode; className?: string; key?: any }) => (
  <div className={cn('bg-white rounded-2xl shadow-sm border border-slate-100/90 overflow-hidden hover:shadow-md hover:border-slate-200/50 transition-all duration-300', className)}>
    {children}
  </div>
);

export const CardHeader = ({ title, action }: { title: ReactNode; action?: ReactNode }) => (
  <div className="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 backdrop-blur-xs">
    <h3 className="font-bold text-slate-500 text-[10px] uppercase tracking-widest">{title}</h3>
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
    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">{label}</span>
    <span className={cn('text-xl font-extrabold text-slate-900 tracking-tight', valueClass)}>{value}</span>
    {subLabel && <span className="text-xs text-slate-400 mt-1">{subLabel}</span>}
  </div>
);

export const Badge = ({ children, variant = 'gray' }: { children: ReactNode; variant?: 'gray' | 'red' | 'yellow' | 'green' | 'blue' }) => {
  const variants = {
    gray: 'bg-slate-500/10 text-slate-600 border-slate-500/10',
    red: 'bg-rose-500/10 text-rose-600 border-rose-500/10',
    yellow: 'bg-amber-500/10 text-amber-600 border-amber-500/10',
    green: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/10',
    blue: 'bg-blue-500/10 text-blue-600 border-blue-500/10',
  };
  return (
    <span className={cn('px-2.5 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider border', variants[variant])}>
      {children}
    </span>
  );
};
