import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
  retryCount: number;
}

class SafeErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;
  private retryTimeout: any = null;

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  async componentDidCatch(error: Error, errorInfo: any) {
    console.error('🚨 Error Boundary caught an error:', error.message);
    console.error('Component Stack:', errorInfo.componentStack);
    
    this.setState({
      hasError: true,
      error,
      errorInfo,
      retryCount: this.state.retryCount + 1
    });

    // Call custom error handler
    this.props.onError?.(error, errorInfo);

    // Auto-retry for recoverable errors
    if (this.state.retryCount < this.maxRetries && this.isRecoverableError(error)) {
      this.scheduleAutoRetry();
    }

    // Log error details for debugging
    this.logErrorDetails(error, errorInfo);
  }

  private isRecoverableError(error: Error): boolean {
    const recoverablePatterns = [
      'Network request failed',
      'Loading chunk',
      'ChunkLoadError',
      'timeout',
      'Fetch failed'
    ];

    return recoverablePatterns.some(pattern => 
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  private scheduleAutoRetry() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }

    // Exponential backoff: 2s, 4s, 8s
    const delay = Math.pow(2, this.state.retryCount) * 1000;
    
    this.retryTimeout = setTimeout(() => {
      console.log('🔄 Auto-retrying after error...');
      this.handleRestart();
    }, delay);
  }

  private async logErrorDetails(error: Error, errorInfo: any) {
    try {
      const errorDetails = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: Date.now(),
        platform: Platform.OS,
        retryCount: this.state.retryCount
      };

      // Log error for analysis
      console.error('Error logged:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: Date.now(),
        platform: Platform.OS,
        retryCount: this.state.retryCount
      });
    } catch (logError) {
      console.error('Failed to log error details:', logError);
    }
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            The app encountered an error but we're fixing it!
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleRestart}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#007bff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SafeErrorBoundary;
