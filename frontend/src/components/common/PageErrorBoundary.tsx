import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  resetKeys?: Array<string | number>;
  onReset?: () => void;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PageErrorBoundary extends Component<Props, State> {
  private resetKeys: Array<string | number>;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.resetKeys = props.resetKeys || [];
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('PageErrorBoundary caught an error:', error, errorInfo);
  }

  public componentDidUpdate(prevProps: Props) {
    const { resetKeys } = this.props;
    const { hasError } = this.state;
    
    if (hasError && prevProps.resetKeys !== resetKeys) {
      const hasResetKeyChanged = resetKeys?.some((key, idx) => key !== prevProps.resetKeys?.[idx]);
      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
      }
    }
  }

  private resetErrorBoundary = () => {
    const { onReset } = this.props;
    onReset?.();
    this.setState({ hasError: false, error: null });
  };

  public render() {
    const { hasError, error } = this.state;
    const { fallback, children } = this.props;

    if (hasError && error) {
      if (fallback) {
        return fallback(error, this.resetErrorBoundary);
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <div className="text-center max-w-md">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Oops! Something went wrong</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {error.message || 'An unexpected error occurred while loading this page.'}
            </p>
            <Button 
              onClick={this.resetErrorBoundary}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return children;
  }
}