"use client";

import React from 'react';
import * as Sentry from "@sentry/nextjs";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, info);
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-[50vh] flex items-center justify-center p-6">
          <section className="max-w-md text-center">
            <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
            <p className="text-muted-foreground mb-4">Please refresh the page. If the issue persists, contact support.</p>
            <button
              className="mb-4 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
              onClick={() => this.setState({ hasError: false, error: undefined })}
            >
              Try recover
            </button>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <pre className="text-xs text-left overflow-auto p-3 rounded bg-muted/50">
                {this.state.error.message}
              </pre>
            )}
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
