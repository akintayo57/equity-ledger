import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import { WatchlistTab } from './Holdings';
import { LayoutDashboard, Eye } from 'lucide-react';

export const Portfolio = () => {
  const location = useLocation();
  const locationState = location.state as { activeTab?: 'SUMMARY' | 'WATCHLIST' } | null;
  const [activeSubTab, setActiveSubTab] = useState<'SUMMARY' | 'WATCHLIST'>('SUMMARY');

  // Handle incoming navigation redirects (e.g. from Detail screens back to specific sub-tabs)
  useEffect(() => {
    if (locationState?.activeTab) {
      setActiveSubTab(locationState.activeTab);
      // Clear location state so refreshes don't reset the tab selection
      window.history.replaceState({}, document.title);
    }
  }, [locationState]);

  // Scroll to top when switching sub-tabs to prevent content from hiding under sticky tab switcher
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeSubTab]);

  const subTabs = [
    { id: 'SUMMARY' as const, name: 'Summary', icon: LayoutDashboard },
    { id: 'WATCHLIST' as const, name: 'Watchlist', icon: Eye },
  ];

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Portfolio</h2>
        <p className="text-xs text-slate-500">Real-time asset valuation, growth rates, and geographical allocation of your holdings.</p>
      </div>

      {/* Horizontal Sub-Tab Switcher - Stickied right below the header */}
      <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none -mx-4 px-4 bg-white sticky top-[53px] z-10 shadow-xs">
        {subTabs.map(tab => {
          const isActive = activeSubTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center space-x-1.5 py-3 px-3.5 border-b-2 text-xs font-semibold whitespace-nowrap transition-all duration-200 shrink-0 cursor-pointer ${
                isActive 
                  ? 'border-blue-600 text-blue-600 bg-blue-50/5' 
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-350'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'stroke-[2.25]' : 'stroke-[1.75]'}`} />
              <span>{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Render Container */}
      <div className="transition-all duration-300">
        {activeSubTab === 'SUMMARY' && <Dashboard />}
        {activeSubTab === 'WATCHLIST' && <WatchlistTab />}
      </div>
    </div>
  );
};

