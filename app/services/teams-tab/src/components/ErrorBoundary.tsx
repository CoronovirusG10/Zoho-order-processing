/**
 * Error Boundary component for graceful error handling
 * Catches JavaScript errors anywhere in child component tree
 */

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Generate a unique error ID for support reference
    const errorId = `ERR-${Date.now().toString(36).toUpperCase()}`;
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // In production, you would send this to an error tracking service
    // e.g., Application Insights, Sentry, etc.
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div
          className="flex min-h-[400px] items-center justify-center p-6"
          role="alert"
          aria-live="assertive"
        >
          <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20">
            <div className="mb-4 text-4xl" aria-hidden="true">
              !!
            </div>

            <h2 className="mb-2 text-xl font-semibold text-red-900 dark:text-red-100">
              Something went wrong
            </h2>

            <p className="mb-4 text-sm text-red-800 dark:text-red-200">
              An unexpected error occurred. Our team has been notified.
            </p>

            {this.state.errorId && (
              <p className="mb-4 font-mono text-xs text-red-600 dark:text-red-400">
                Reference: {this.state.errorId}
              </p>
            )}

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-4 text-left">
                <summary className="cursor-pointer text-sm text-red-700 dark:text-red-300">
                  Technical details
                </summary>
                <pre className="mt-2 overflow-x-auto rounded bg-white p-2 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                onClick={this.handleRetry}
                className="rounded-md bg-teams-purple px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-teams-purple focus:ring-offset-2"
              >
                Try Again
              </button>

              <button
                onClick={this.handleReload}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teams-purple focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-friendly error boundary wrapper for specific sections
 */
interface SectionErrorBoundaryProps {
  children: ReactNode;
  sectionName: string;
}

export function SectionErrorBoundary({
  children,
  sectionName,
}: SectionErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
          role="alert"
        >
          <p className="text-sm text-red-800 dark:text-red-200">
            Failed to load {sectionName}. Please try refreshing the page.
          </p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
