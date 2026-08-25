import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function AccordionCard({
  title,
  subtitle,
  badge,
  headerExtra,
  children,
  defaultOpen = false,
  className = '',
  headerClassName = '',
  bodyClassName = ''
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden transition-all duration-200 ${className}`}>
      {/* Clickable Card Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`p-4 min-h-[52px] flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/80 active:bg-slate-100/80 transition-colors ${headerClassName}`}
      >
        <div className="flex-1 min-w-0 flex items-center gap-3">
          {typeof title === 'string' ? (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-slate-900 text-sm truncate">{title}</h4>
                {badge}
              </div>
              {subtitle && <p className="text-xs text-slate-500 font-normal truncate mt-0.5">{subtitle}</p>}
            </div>
          ) : (
            title
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {headerExtra}
          <div className={`w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center transition-transform duration-200 ${isOpen ? 'rotate-180 bg-slate-200 text-slate-800' : ''}`}>
            <ChevronDown size={16} />
          </div>
        </div>
      </div>

      {/* Expandable Body */}
      {isOpen && (
        <div className={`p-4 pt-2 border-t border-slate-100 bg-slate-50/40 space-y-3 text-xs ${bodyClassName}`}>
          {children}
        </div>
      )}
    </div>
  );
}
