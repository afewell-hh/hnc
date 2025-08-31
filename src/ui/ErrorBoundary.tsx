import React from 'react';

export class ErrorBoundary extends React.Component<
  { fallback?: React.ReactNode; children?: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  
  static getDerivedStateFromError() { 
    return { hasError: true }; 
  }
  
  componentDidCatch() {
    // no-op; could log in development
  }
  
  render() { 
    return this.state.hasError ? (this.props.fallback ?? null) : this.props.children; 
  }
}