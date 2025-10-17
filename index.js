/**
 * @format
 */

// Buffer polyfill for React Native
import { Buffer } from 'buffer';
global.Buffer = Buffer;

// Test Buffer availability
console.log('✅ Buffer polyfill loaded:', typeof global.Buffer !== 'undefined');

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
