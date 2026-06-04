import React from 'react';

/**
 * React Error Boundary — catches unhandled render errors gracefully.
 * Shows a fallback UI instead of a blank screen crash.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
        <div className="bg-slate-800 border border-red-500/40 rounded-xl p-8 max-w-lg text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-red-400 font-bold text-lg font-mono">Render Error</h2>
          <p className="text-slate-400 text-sm">
            The dashboard encountered an unexpected error.
          </p>
          <div className="bg-slate-900 rounded p-4 text-left text-xs text-red-300 font-mono overflow-auto max-h-40">
            {this.state.error?.message || 'Unknown error'}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded text-sm font-mono transition-colors">
            Reload Dashboard
          </button>
        </div>
      </div>
    );
  }
}
