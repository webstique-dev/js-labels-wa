import React from 'react';

/**
 * Base Skeleton Component with smooth shimmer pulse animation
 */
export function Skeleton({ className = '', width, height, style = {}, ...props }) {
  const customStyle = { ...style };
  if (width) customStyle.width = typeof width === 'number' ? `${width}px` : width;
  if (height) customStyle.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`animate-pulse bg-slate-200/80 rounded-xl transition ${className}`}
      style={customStyle}
      {...props}
    />
  );
}

/**
 * Skeleton Text Lines
 */
export function SkeletonText({ lines = 1, className = 'h-4 w-full mb-2', lastLineWidth = '70%' }) {
  return (
    <div className="space-y-2 w-full">
      {Array.from({ length: lines }).map((_, idx) => (
        <Skeleton
          key={idx}
          className={`${className} ${idx === lines - 1 && lines > 1 ? `!w-[${lastLineWidth}]` : ''}`}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton Avatar
 */
export function SkeletonAvatar({ size = 40, className = '', shape = 'circle' }) {
  const roundedClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';
  return (
    <Skeleton
      width={size}
      height={size}
      className={`${roundedClass} shrink-0 ${className}`}
    />
  );
}

/**
 * Skeleton Card Container
 */
export function SkeletonCard({ className = '', children }) {
  return (
    <div className={`bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs ${className}`}>
      {children || (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-1/3" />
            <SkeletonAvatar size={32} />
          </div>
          <Skeleton className="h-7 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      )}
    </div>
  );
}

/**
 * Responsive Skeleton Table (Desktop table view + Mobile card view fallback)
 */
export function SkeletonTable({ rows = 5, cols = 5, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden ${className}`}>
      
      {/* Desktop / Tablet Scrollable Table */}
      <div className="hidden sm:block overflow-x-auto scrollbar-hide">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200/80">
              {Array.from({ length: cols }).map((_, idx) => (
                <th key={idx} className="p-4">
                  <Skeleton className="h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Array.from({ length: rows }).map((_, rIdx) => (
              <tr key={rIdx}>
                {Array.from({ length: cols }).map((_, cIdx) => (
                  <td key={cIdx} className="p-4">
                    <Skeleton className={`h-4 ${cIdx === 0 ? 'w-32 font-semibold' : cIdx === cols - 1 ? 'w-16 ml-auto' : 'w-24'}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View Fallback */}
      <div className="sm:hidden p-4 space-y-3">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="p-3.5 border border-slate-100 rounded-xl space-y-2.5 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

/**
 * Skeleton List View
 */
export function SkeletonList({ count = 4, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 w-full min-w-0">
            <SkeletonAvatar size={36} />
            <div className="space-y-1.5 w-full max-w-xs min-w-0">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-7 sm:h-8 w-16 sm:w-20 rounded-xl shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton Stat Cards Grid (Responsive Grid 1 to 4 cols)
 */
export function SkeletonStatsGrid({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
      {Array.from({ length: count }).map((_, idx) => (
        <SkeletonCard key={idx} />
      ))}
    </div>
  );
}

export default Skeleton;

