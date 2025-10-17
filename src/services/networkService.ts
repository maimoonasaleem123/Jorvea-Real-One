import { Alert } from 'react-native';

export class NetworkService {
  private static listeners: Array<(isConnected: boolean) => void> = [];
  private static isConnected: boolean = true;

  static initialize() {
    // For now, assume we're connected
    // This can be enhanced later with actual network checking
    this.isConnected = true;
    console.log('Network service initialized');
  }

  static isNetworkConnected(): boolean {
    return this.isConnected;
  }

  static async checkConnection(): Promise<boolean> {
    try {
      // Simple connectivity check by trying to fetch a small resource
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      this.isConnected = response.ok;
      return this.isConnected;
    } catch (error) {
      console.log('Network check failed, assuming offline:', error);
      this.isConnected = false;
      return false;
    }
  }

  static addListener(listener: (isConnected: boolean) => void) {
    this.listeners.push(listener);
  }

  static removeListener(listener: (isConnected: boolean) => void) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private static notifyListeners(isConnected: boolean) {
    this.listeners.forEach(listener => {
      try {
        listener(isConnected);
      } catch (error) {
        console.error('Error in network listener:', error);
      }
    });
  }

  static showOfflineAlert() {
    Alert.alert(
      'No Internet Connection',
      'Please check your internet connection and try again.',
      [{ text: 'OK' }]
    );
  }

  static async withNetworkCheck<T>(
    asyncFunction: () => Promise<T>,
    showAlert: boolean = true
  ): Promise<T | null> {
    try {
      const isConnected = await this.checkConnection();
      
      if (!isConnected) {
        if (showAlert) {
          this.showOfflineAlert();
        }
        return null;
      }
      
      return await asyncFunction();
    } catch (error) {
      console.error('Network operation failed:', error);
      
      if (showAlert) {
        Alert.alert(
          'Connection Error',
          'Unable to complete the operation. Please try again.',
          [{ text: 'OK' }]
        );
      }
      
      return null;
    }
  }
}

export default NetworkService;
