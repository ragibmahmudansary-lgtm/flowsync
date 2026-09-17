import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[FlowSync ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-red-50 p-8">
          <div className="max-w-2xl w-full bg-white border-2 border-red-300 rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-4 w-4 rounded-full bg-red-500" />
              <h1 className="text-lg font-bold text-red-800">
                FlowSync — Render Error
              </h1>
            </div>
            <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
              <p className="text-sm font-mono text-red-900 mb-2">
                {this.state.error.message}
              </p>
              <pre className="text-xs font-mono text-red-700 whitespace-pre-wrap overflow-auto max-h-60">
                {this.state.error.stack}
              </pre>
            </div>
            <div className="flex gap-3">
              <button
                className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                onClick={() => window.location.reload()}
              >
                Reload App
              </button>
              <button
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300"
                onClick={() => this.setState({ hasError: false, error: null })}
              >
                Dismiss
              </button>
            </div>
            <p className="mt-4 text-xs text-gray-500">
              This error was caught by the FlowSync ErrorBoundary. Paste the
              above details to the team for diagnosis.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
