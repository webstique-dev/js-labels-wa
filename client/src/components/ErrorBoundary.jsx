import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Always print full error stack and component stack trace to browser console
    console.error("=================== REACT COMPONENT ERROR ===================");
    console.error("Error Message:", error?.message || error);
    console.error("Stack Trace:", error?.stack);
    console.error("Component Stack:", errorInfo?.componentStack);
    console.error("=============================================================");
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
          <div className="bg-white max-w-lg w-full rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900">Something went wrong</h2>
              <p className="text-xs text-slate-500 font-normal">
                An unexpected error occurred while rendering this page. The details have been logged to your console.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-slate-900 text-rose-300 rounded-xl text-xs font-mono overflow-x-auto max-h-40 border border-slate-800">
                <p className="font-bold text-white mb-1">{this.state.error.toString()}</p>
                {this.state.errorInfo && (
                  <pre className="text-[10px] text-slate-400 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Reload Page</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
