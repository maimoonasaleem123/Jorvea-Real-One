import React, { useEffect } from 'react';
import { LightningFast } from '../services/LightningFastService';
import { useAuth } from '../context/FastAuthContext';
import AdvancedBackgroundUploadEngine from '../services/AdvancedBackgroundUploadEngine';
import AdvancedSegmentedVideoFetcher from '../services/AdvancedSegmentedVideoFetcher';
import InstantReelsPreloader from '../services/InstantReelsPreloader';
import { InstantCache } from '../services/InstantCacheService';

interface LightningFastInitializerProps {
  children: React.ReactNode;
}

export const LightningFastInitializer: React.FC<LightningFastInitializerProps> = ({ children }) => {
  const { user } = useAuth();

  useEffect(() => {
    // Initialize Lightning Fast Service as soon as possible
    const initializeFastService = async () => {
      try {
        console.log('⚡ Initializing Lightning Fast Service...');
        await LightningFast.initialize();
        
        // Initialize Enhanced Instant Cache Service
        console.log('⚡ Initializing Enhanced Instant Cache Service...');
        await InstantCache.initializeCache();
        
        if (user?.uid) {
          // Prefetch user content immediately for instant experience
          console.log('⚡ Prefetching user content for instant loading...');
          await LightningFast.prefetchUserContent(user.uid);
        }

        console.log('⚡ Lightning Fast Service ready! Your app is now Instagram-speed! 🚀');
        
        // Initialize advanced services in background after main service is ready
        setTimeout(() => {
          initializeAdvancedServices();
        }, 2000);
        
      } catch (error) {
        console.error('Failed to initialize Lightning Fast Service:', error);
      }
    };

    const initializeAdvancedServices = async () => {
      // Initialize Advanced Background Upload Engine
      try {
        console.log('⚡ Initializing Advanced Background Upload Engine...');
        const uploadEngine = AdvancedBackgroundUploadEngine.getInstance();
        if (uploadEngine && typeof uploadEngine.initialize === 'function') {
          await uploadEngine.initialize();
          console.log('✅ Advanced Background Upload Engine initialized successfully');
        } else {
          console.warn('⚠️ Advanced Background Upload Engine not available');
        }
      } catch (uploadError) {
        console.error('❌ Failed to initialize upload engine:', uploadError);
      }
      
      // Initialize Advanced Segmented Video Fetcher
      try {
        console.log('⚡ Initializing Advanced Segmented Video Fetcher...');
        const videoFetcher = AdvancedSegmentedVideoFetcher.getInstance();
        if (videoFetcher && typeof videoFetcher.initialize === 'function') {
          await videoFetcher.initialize();
          console.log('✅ Advanced Segmented Video Fetcher initialized successfully');
        } else {
          console.warn('⚠️ Advanced Segmented Video Fetcher not available');
        }
      } catch (videoError) {
        console.error('❌ Failed to initialize video fetcher:', videoError);
      }
      
      // Initialize Instant Reels Preloader
      if (user?.uid) {
        try {
          console.log('⚡ Initializing Instant Reels Preloader...');
          const reelsPreloader = InstantReelsPreloader.getInstance();
          await reelsPreloader.initialize(user.uid);
          console.log('✅ Instant Reels Preloader initialized successfully');
        } catch (preloaderError) {
          console.error('❌ Failed to initialize reels preloader:', preloaderError);
        }
      }
    };

    initializeFastService();
  }, [user?.uid]);

  return <>{children}</>;
};
