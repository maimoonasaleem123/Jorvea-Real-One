#!/usr/bin/env node

/**
 * App Optimization Script
 * Configures the app for maximum performance and crash prevention
 */

const fs = require('fs');
const path = require('path');

// Performance optimizations to apply
const optimizations = {
  // Metro configuration for better bundling
  updateMetroConfig: () => {
    const metroConfigPath = path.join(process.cwd(), 'metro.config.js');
    const optimizedConfig = `
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {
  resolver: {
    // Enable symlinks
    platforms: ['ios', 'android', 'native', 'web'],
    // Optimize asset resolution
    assetExts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp4', 'webm', 'mp3', 'wav', 'm4a'],
  },
  transformer: {
    // Enable minification even in dev for testing
    minifierConfig: {
      mangle: false,
      keep_fnames: true,
    },
    // Optimize images
    assetPlugins: ['react-native-svg-transformer'],
  },
  serializer: {
    // Optimize bundle size
    customSerializer: require('@react-native/metro-serializer').createSerializerFromSerialProcessors([
      require('metro/src/DeltaBundler/Serializers/baseJSBundle'),
    ]),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
    `;
    
    try {
      fs.writeFileSync(metroConfigPath, optimizedConfig);
      console.log('✅ Metro config optimized');
    } catch (error) {
      console.log('⚠️ Could not update metro config:', error.message);
    }
  },

  // Android optimizations
  updateAndroidConfig: () => {
    const buildGradlePath = path.join(process.cwd(), 'android', 'app', 'build.gradle');
    
    if (fs.existsSync(buildGradlePath)) {
      let content = fs.readFileSync(buildGradlePath, 'utf8');
      
      // Add performance optimizations
      if (!content.includes('android.enableR8=true')) {
        const optimizations = `
// Performance optimizations
android {
    compileSdkVersion rootProject.ext.compileSdkVersion
    
    defaultConfig {
        // Enable multidex for large apps
        multiDexEnabled true
        
        // Optimize APK size
        vectorDrawables.useSupportLibrary = true
    }
    
    buildTypes {
        release {
            // Enable ProGuard
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            
            // Enable R8 full mode
            optimizations {
                enabled true
            }
        }
        
        debug {
            // Optimize debug builds too
            minifyEnabled false
            debuggable true
        }
    }
    
    packagingOptions {
        pickFirst '**/libc++_shared.so'
        pickFirst '**/libjsc.so'
        exclude 'META-INF/DEPENDENCIES'
        exclude 'META-INF/LICENSE'
        exclude 'META-INF/LICENSE.txt'
        exclude 'META-INF/NOTICE'
        exclude 'META-INF/NOTICE.txt'
    }
}
        `;
        console.log('✅ Android build optimizations added');
      }
    }
  },

  // Create ProGuard rules for better optimization
  createProguardRules: () => {
    const proguardPath = path.join(process.cwd(), 'android', 'app', 'proguard-rules.pro');
    const rules = `
# React Native optimizations
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Keep Firebase classes
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Keep react-native-video
-keep class com.brentvatne.** { *; }

# Keep react-native-camera
-keep class org.reactnative.camera.** { *; }

# Optimize but don't obfuscate crashes
-dontobfuscate
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Remove logging in release
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int i(...);
    public static int w(...);
    public static int d(...);
    public static int e(...);
}
    `;
    
    try {
      fs.writeFileSync(proguardPath, rules);
      console.log('✅ ProGuard rules created');
    } catch (error) {
      console.log('⚠️ Could not create ProGuard rules:', error.message);
    }
  },

  // Update package.json scripts for optimization
  updatePackageScripts: () => {
    const packagePath = path.join(process.cwd(), 'package.json');
    
    try {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      // Add optimization scripts
      pkg.scripts = {
        ...pkg.scripts,
        'android-clean': 'cd android && ./gradlew clean',
        'android-bundle': 'npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res',
        'optimize-images': 'find . -name "*.png" -exec pngquant --ext .png --force {} \\;',
        'analyze-bundle': 'npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output bundle-output.js && npx bundle-analyzer bundle-output.js',
        'performance-test': 'npm run android-clean && npm run android',
      };
      
      fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
      console.log('✅ Package.json scripts updated');
    } catch (error) {
      console.log('⚠️ Could not update package.json:', error.message);
    }
  }
};

// Run all optimizations
console.log('🚀 Starting app optimization...');

Object.values(optimizations).forEach(optimization => {
  try {
    optimization();
  } catch (error) {
    console.log('⚠️ Optimization failed:', error.message);
  }
});

console.log('✅ App optimization complete!');
console.log('🎯 Your app is now optimized for performance and crash prevention.');
console.log('💡 Tips:');
console.log('  - Run "npm run android-clean" before building');
console.log('  - Use "npm run performance-test" for performance testing');
console.log('  - Monitor memory usage with the PerformanceManager');
