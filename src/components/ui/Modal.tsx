import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative w-full max-w-md overflow-hidden bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 backdrop-blur-lg rounded-2xl shadow-2xl text-slate-900 dark:text-white z-10 transition-colors duration-300"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-850 dark:text-slate-100">{title}</h3>
              <button
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
}

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
}: ConfirmDialogProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.35 }}
            className="relative w-full max-w-sm overflow-hidden bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 backdrop-blur-lg rounded-2xl shadow-2xl text-slate-900 dark:text-white z-10 p-6 transition-colors duration-300"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              {/* Icon Container */}
              <div
                className={`p-3 rounded-full shrink-0 ${
                  type === 'danger'
                    ? 'bg-rose-500/20 text-rose-400'
                    : type === 'info'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}
              >
                {type === 'danger' || type === 'warning' ? (
                  <AlertTriangle className="w-8 h-8" />
                ) : (
                  <Info className="w-8 h-8" />
                )}
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
              </div>

              {/* Buttons */}
              <div className="flex items-center space-x-3 w-full pt-3">
                 <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
                >
                  {cancelText}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={`flex-1 py-2 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg ${
                    type === 'danger'
                      ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/25'
                      : type === 'info'
                      ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/25'
                      : 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/25'
                  }`}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'success' | 'info' | 'error';
  buttonText?: string;
}

export const AlertDialog = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  buttonText = 'Dismiss',
}: AlertDialogProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.35 }}
            className="relative w-full max-w-sm overflow-hidden bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 backdrop-blur-lg rounded-2xl shadow-2xl text-slate-900 dark:text-white z-10 p-6 transition-colors duration-300"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              {/* Icon Container */}
              <div
                className={`p-3 rounded-full shrink-0 ${
                  type === 'success'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : type === 'error'
                    ? 'bg-rose-500/20 text-rose-400'
                    : 'bg-blue-500/20 text-blue-400'
                }`}
              >
                {type === 'success' ? (
                  <CheckCircle className="w-8 h-8" />
                ) : type === 'error' ? (
                  <AlertTriangle className="w-8 h-8" />
                ) : (
                  <Info className="w-8 h-8" />
                )}
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-850 dark:text-slate-100">{title}</h3>
                <p className="text-sm text-slate-550 dark:text-slate-400 leading-relaxed">{message}</p>
              </div>

              {/* Button */}
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-900/25 transition-colors"
              >
                {buttonText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
