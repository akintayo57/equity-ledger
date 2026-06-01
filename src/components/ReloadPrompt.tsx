import { useRegisterSW } from 'virtual:pwa-register/react';
import { CloudLightning, RefreshCw, X } from 'lucide-react';

export function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('PWA Service Worker registered:', r);
    },
    onRegisterError(error) {
      console.error('PWA Service Worker registration error:', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) {
    return null;
  }

  return (
    <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-slate-800 z-50 transition-all duration-300 animate-in fade-in slide-in-from-bottom-5">
      <div className="flex items-start space-x-3">
        <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg shrink-0">
          {offlineReady ? (
            <CloudLightning className="w-5 h-5" />
          ) : (
            <RefreshCw className="w-5 h-5 animate-spin" style={{ animationDuration: '3s' }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-slate-100">
            {offlineReady ? 'App Offline Ready' : 'Update Available'}
          </h4>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            {offlineReady
              ? 'Harbour Finance is now cached and ready to be used completely offline.'
              : 'A new version of Harbour Finance is ready. Update now to see the latest changes.'}
          </p>
          <div className="flex items-center space-x-2 mt-3">
            {needRefresh && (
              <button
                onClick={() => updateServiceWorker(true)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-md transition-colors"
              >
                Update Now
              </button>
            )}
            <button
              onClick={close}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors"
            >
              Later
            </button>
          </div>
        </div>
        <button
          onClick={close}
          className="p-1 hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
