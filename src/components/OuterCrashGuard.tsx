import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

interface OuterCrashGuardState {
  hasError: boolean;
  error?: Error;
}

interface OuterCrashGuardProps {
  children: React.ReactNode;
}

/**
 * Outer crash guard that doesn't depend on any context providers
 * This protects against provider initialization errors
 */
export class OuterCrashGuard extends React.Component<OuterCrashGuardProps, OuterCrashGuardState> {
  constructor(props: OuterCrashGuardProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): OuterCrashGuardState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 Outer Crash Guard caught error:', error, errorInfo);
    
    // Log to crash analytics (if available)
    if (__DEV__) {
      console.error('Error Stack:', error.stack);
      console.error('Component Stack:', errorInfo.componentStack);
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return <OuterErrorFallback error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

// Simple error fallback without any dependencies
const OuterErrorFallback: React.FC<{ error?: Error; resetError: () => void }> = ({ 
  error, 
  resetError 
}) => {
  const colors = {
    background: '#000000',
    surface: '#1a1a1a',
    text: '#ffffff',
    textSecondary: '#cccccc',
    primary: '#007AFF',
    error: '#FF453A',
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Icon name="alert-circle" size={64} color={colors.error} style={styles.icon} />
        
        <Text style={[styles.title, { color: colors.text }]}>
          Something went wrong
        </Text>
        
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          Please restart the app to continue.
        </Text>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={resetError}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Restart App</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
  },
  icon: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  errorDetails: {
    width: '100%',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 16,
    marginBottom: 8,
  },
  errorStack: {
    fontSize: 10,
    fontFamily: 'monospace',
    lineHeight: 14,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: 'center',
    minWidth: 200,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
