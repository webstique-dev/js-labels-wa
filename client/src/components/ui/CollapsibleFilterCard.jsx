import React, { useState } from 'react';
import { Filter, ChevronDown, RotateCcw } from 'lucide-react';

export default function CollapsibleFilterCard({
  title = 'Filters & Search',
  activeCount = 0,
  onClear,
  children,
  className = '',
  defaultOpen = false
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden transition-all duration-200 ${className}`}>
      {/* Mobile Collapsible Header (hidden on md and above) */}
      <div className="md:hidden">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none bg-slate-50/70 hover:bg-slate-100/80 active:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-2xs shrink-0">
              <Filter size={15} />
            </div>
            <div className="min-w-0 flex items-center gap-2">
              <span className="font-semibold text-slate-900 text-xs tracking-tight">{title}</span>
              {activeCount > 0 && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full border border-red-200">
                  {activeCount} active
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeCount > 0 && onClear && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            )}

            <div className={`w-7 h-7 rounded-lg bg-slate-200/70 text-slate-600 flex items-center justify-center transition-transform duration-200 ${isOpen ? 'rotate-180 bg-slate-300 text-slate-900' : ''}`}>
              <ChevronDown size={15} />
            </div>
          </div>
        </div>

        {/* Mobile Filter Controls (Expanded Body) */}
        {isOpen && (
          <div className="p-4 border-t border-slate-200/80 bg-white space-y-3 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
            {children}
          </div>
        )}
      </div>

      {/* Desktop View (Always visible on md and above) */}
      <div className="hidden md:block p-4">
        {children}
      </div>
    </div>
  );
}
