'use client';

import { CheckCircle2, AlertCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export interface ToastState {
  message: string;
  variant?: 'success' | 'error';
}

export function Toast({ toast }: { toast: ToastState | null }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.18 }}
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#f5f2f3] text-[#080808] text-xs font-semibold shadow-xl border border-white/20 whitespace-nowrap"
        >
          {toast.variant === 'error' ? (
            <AlertCircle className="w-4 h-4 text-[#f12b3d] shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <span>{toast.message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
