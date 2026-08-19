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
      className={`${roundedClass} flex-shrink-0 ${className}`}
    />
  );
}

/**
 * Skeleton Card Container
 */
export function SkeletonCard({ className = '', children }) {
  return (
    <div className={`bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs ${className}`}>
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
 * Skeleton Table (Matching app tables)
 */
export function SkeletonTable({ rows = 5, cols = 5, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden ${className}`}>
      <table className="w-full text-left border-collapse">
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
  );
}

/**
 * Skeleton List View
 */
export function SkeletonList({ count = 4, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="p-4 bg-white rounded-2xl border border-slate-200/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full">
            <SkeletonAvatar size={40} />
            <div className="space-y-1.5 w-full max-w-sm">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-8 w-20 rounded-xl flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton Stat Cards Grid (Top Metrics)
 */
export function SkeletonStatsGrid({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      {Array.from({ length: count }).map((_, idx) => (
        <SkeletonCard key={idx} />
      ))}
    </div>
  );
}

export default Skeleton;
