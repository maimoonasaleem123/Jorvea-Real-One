
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {
  resolver: {
    // Enable symlinks
    platforms: ['ios', 'android', 'native', 'web'],
    // Optimize asset resolution
    assetExts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp4', 'webm', 'mp3', 'wav', 'm4a'],
    // Add polyfills
    alias: {
      buffer: 'buffer',
    },
  },
  transformer: {
    // Enable minification even in dev for testing
    minifierConfig: {
      mangle: false,
      keep_fnames: true,
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
    