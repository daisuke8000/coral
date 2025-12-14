import { Component, type ReactNode, type ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component to catch and display React errors gracefully
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-bg-dark text-text-primary gap-4 p-4">
          <div className="text-5xl">⚠️</div>
          <h2 className="text-xl sm:text-2xl font-bold text-red-400">Something went wrong</h2>
          <p className="text-sm sm:text-base text-text-secondary max-w-md text-center">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            className="px-6 py-2.5 bg-transparent border-2 border-neon-magenta rounded-lg text-neon-magenta text-sm cursor-pointer transition-all duration-300 hover:bg-neon-magenta/10 hover:shadow-[0_0_10px_var(--color-neon-magenta)] active:scale-95 min-h-[44px] touch-manipulation"
            onClick={this.handleReset}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
