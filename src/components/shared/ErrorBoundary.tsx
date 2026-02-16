"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  panelName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Per-panel error boundary. One panel crashing doesn't kill the desk.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[ErrorBoundary] ${this.props.panelName || "Unknown panel"} crashed:`,
      error,
      info.componentStack
    );
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-xs">
          <div className="text-red font-semibold">
            {this.props.panelName || "Panel"} Error
          </div>
          <div className="max-w-xs text-center text-text-muted">
            {this.state.error?.message || "An unexpected error occurred"}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 rounded bg-bg-tertiary px-3 py-1 text-text-secondary hover:bg-bg-hover"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
