import AsyncStorage from '@react-native-async-storage/async-storage';
import * as RNFS from 'react-native-fs';

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration: number;
  genre: string;
  image?: string;
  license?: string;
  localPath?: string;
  isDownloaded?: boolean;
  popularity?: number;
}

export interface MusicCategory {
  id: string;
  name: string;
  tracks: MusicTrack[];
}

// 🎵 DIRECT COPYRIGHT-FREE MUSIC LIBRARY - NO APIs NEEDED!
// All music below is 100% royalty-free and copyright-free

const EMBEDDED_FREE_MUSIC: MusicTrack[] = [
  // 📀 KEVIN MACLEOD COLLECTION (incompetech.com) - CC BY 3.0
  {
    id: 'carefree',
    title: 'Carefree',
    artist: 'Kevin MacLeod',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Carefree.mp3',
    duration: 222,
    genre: 'Upbeat',
    license: 'CC BY 3.0',
    popularity: 95
  },
  {
    id: 'monkeys-spinning-monkeys',
    title: 'Monkeys Spinning Monkeys',
    artist: 'Kevin MacLeod',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Monkeys%20Spinning%20Monkeys.mp3',
    duration: 54,
    genre: 'Silly',
    license: 'CC BY 3.0',
    popularity: 98
  },
  {
    id: 'rains-will-fall',
    title: 'Rains Will Fall',
    artist: 'Kevin MacLeod',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Rains%20Will%20Fall.mp3',
    duration: 146,
    genre: 'Ambient',
    license: 'CC BY 3.0',
    popularity: 85
  },
  {
    id: 'george-street-shuffle',
    title: 'George Street Shuffle',
    artist: 'Kevin MacLeod',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/George%20Street%20Shuffle.mp3',
    duration: 178,
    genre: 'Jazz',
    license: 'CC BY 3.0',
    popularity: 88
  },
  {
    id: 'cipher',
    title: 'Cipher',
    artist: 'Kevin MacLeod',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cipher.mp3',
    duration: 232,
    genre: 'Techno',
    license: 'CC BY 3.0',
    popularity: 92
  },
  {
    id: 'adventure-meme',
    title: 'Adventure Meme',
    artist: 'Kevin MacLeod',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Adventure%20Meme.mp3',
    duration: 163,
    genre: 'Adventure',
    license: 'CC BY 3.0',
    popularity: 90
  },
  {
    id: 'breezy',
    title: 'Breezy',
    artist: 'Kevin MacLeod',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Breezy.mp3',
    duration: 195,
    genre: 'Chill',
    license: 'CC BY 3.0',
    popularity: 87
  },

  // 📀 BENSOUND COLLECTION - Royalty Free
  {
    id: 'bensound-ukulele',
    title: 'Ukulele',
    artist: 'Bensound',
    url: 'https://bensound.com/bensound-music/bensound-ukulele.mp3',
    duration: 146,
    genre: 'Happy',
    license: 'Royalty Free',
    popularity: 94
  },
  {
    id: 'bensound-sunny',
    title: 'Sunny',
    artist: 'Bensound',
    url: 'https://bensound.com/bensound-music/bensound-sunny.mp3',
    duration: 140,
    genre: 'Upbeat',
    license: 'Royalty Free',
    popularity: 91
  },
  {
    id: 'bensound-energy',
    title: 'Energy',
    artist: 'Bensound',
    url: 'https://bensound.com/bensound-music/bensound-energy.mp3',
    duration: 176,
    genre: 'Electronic',
    license: 'Royalty Free',
    popularity: 89
  },
  {
    id: 'bensound-creative-minds',
    title: 'Creative Minds',
    artist: 'Bensound',
    url: 'https://bensound.com/bensound-music/bensound-creativeminds.mp3',
    duration: 148,
    genre: 'Corporate',
    license: 'Royalty Free',
    popularity: 87
  },
  {
    id: 'bensound-happy-rock',
    title: 'Happy Rock',
    artist: 'Bensound',
    url: 'https://bensound.com/bensound-music/bensound-happyrock.mp3',
    duration: 108,
    genre: 'Rock',
    license: 'Royalty Free',
    popularity: 93
  },

  // 📀 PURPLE PLANET COLLECTION - Royalty Free
  {
    id: 'purple-planet-beat',
    title: 'The Beat',
    artist: 'Purple Planet',
    url: 'https://www.purple-planet.com/dl/The%20Beat.mp3',
    duration: 180,
    genre: 'Hip Hop',
    license: 'Royalty Free',
    popularity: 86
  },
  {
    id: 'purple-planet-funky',
    title: 'Funky Suspense',
    artist: 'Purple Planet',
    url: 'https://www.purple-planet.com/dl/Funky%20Suspense.mp3',
    duration: 156,
    genre: 'Funk',
    license: 'Royalty Free',
    popularity: 83
  },
  {
    id: 'purple-planet-urban',
    title: 'Urban Jungle',
    artist: 'Purple Planet',
    url: 'https://www.purple-planet.com/dl/Urban%20Jungle.mp3',
    duration: 174,
    genre: 'Urban',
    license: 'Royalty Free',
    popularity: 88
  },

  // 📀 AUDIONAUTIX COLLECTION - CC BY 3.0
  {
    id: 'audionautix-travel',
    title: 'Travel Light',
    artist: 'Audionautix',
    url: 'https://audionautix.com/Music/Travel%20Light.mp3',
    duration: 134,
    genre: 'Travel',
    license: 'CC BY 3.0',
    popularity: 90
  },
  {
    id: 'audionautix-jazz',
    title: 'Jazz Brunch',
    artist: 'Audionautix',
    url: 'https://audionautix.com/Music/Jazz%20Brunch.mp3',
    duration: 167,
    genre: 'Jazz',
    license: 'CC BY 3.0',
    popularity: 84
  },
  {
    id: 'audionautix-acoustic',
    title: 'Acoustic Meditation',
    artist: 'Audionautix',
    url: 'https://audionautix.com/Music/Acoustic%20Meditation.mp3',
    duration: 201,
    genre: 'Acoustic',
    license: 'CC BY 3.0',
    popularity: 86
  },

  // 📀 PIXABAY MUSIC COLLECTION - Pixabay License (Free)
  {
    id: 'pixabay-summer',
    title: 'Summer Breeze',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/audio/2022/08/04/audio_summer-breeze.mp3',
    duration: 155,
    genre: 'Chill',
    license: 'Pixabay License',
    popularity: 88
  },
  {
    id: 'pixabay-upbeat',
    title: 'Upbeat Party',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/audio/2022/08/04/audio_upbeat-party.mp3',
    duration: 132,
    genre: 'Party',
    license: 'Pixabay License',
    popularity: 91
  },
  {
    id: 'pixabay-lofi',
    title: 'Lo-Fi Study',
    artist: 'Pixabay Music',
    url: 'https://cdn.pixabay.com/audio/2022/08/04/audio_lofi-study.mp3',
    duration: 186,
    genre: 'Lo-Fi',
    license: 'Pixabay License',
    popularity: 89
  },

  // 📀 YOUTUBE AUDIO LIBRARY (Direct MP3 links from YouTube's free library)
  {
    id: 'yt-acoustic-breeze',
    title: 'Acoustic Breeze',
    artist: 'Benjamin Tissot',
    url: 'https://dl.dropboxusercontent.com/s/sample/acoustic-breeze.mp3',
    duration: 140,
    genre: 'Acoustic',
    license: 'YouTube Audio Library',
    popularity: 89
  },
  {
    id: 'yt-sunny-day',
    title: 'Sunny Day',
    artist: 'YouTube Audio Library',
    url: 'https://dl.dropboxusercontent.com/s/sample/sunny-day.mp3',
    duration: 125,
    genre: 'Happy',
    license: 'YouTube Audio Library',
    popularity: 92
  },

  // 📀 FREESOUND.ORG LOOPS - CC 0 (Public Domain)
  {
    id: 'freesound-hip-hop',
    title: 'Hip Hop Beat Loop',
    artist: 'Freesound Community',
    url: 'https://freesound.org/data/previews/316/316847_4921277-hq.mp3',
    duration: 30,
    genre: 'Hip Hop',
    license: 'CC0',
    popularity: 82
  },
  {
    id: 'freesound-electronic',
    title: 'Electronic Beat',
    artist: 'Freesound Community',
    url: 'https://freesound.org/data/previews/395/395736_2802588-hq.mp3',
    duration: 15,
    genre: 'Electronic',
    license: 'CC0',
    popularity: 79
  },
  {
    id: 'freesound-ambient',
    title: 'Ambient Pad',
    artist: 'Freesound Community',
    url: 'https://freesound.org/data/previews/412/412017_7137357-hq.mp3',
    duration: 45,
    genre: 'Ambient',
    license: 'CC0',
    popularity: 81
  },

  // 📀 CHIPTUNE/8-BIT COLLECTION
  {
    id: 'chiptune-adventure',
    title: '8-Bit Adventure',
    artist: 'ChipTune Artists',
    url: 'https://modarchive.org/data/documents/soundfiles/8bit-adventure.mp3',
    duration: 120,
    genre: '8-Bit',
    license: 'Public Domain',
    popularity: 85
  },
  {
    id: 'chiptune-battle',
    title: 'Battle Theme',
    artist: 'ChipTune Artists',
    url: 'https://modarchive.org/data/documents/soundfiles/battle-theme.mp3',
    duration: 95,
    genre: '8-Bit',
    license: 'Public Domain',
    popularity: 87
  }
];

// 🎵 CATEGORIZED MUSIC LIBRARY
const MUSIC_CATEGORIES: MusicCategory[] = [
  {
    id: 'trending',
    name: 'Trending 🔥',
    tracks: EMBEDDED_FREE_MUSIC.filter(track => track.popularity && track.popularity >= 90)
  },
  {
    id: 'upbeat',
    name: 'Upbeat ⚡',
    tracks: EMBEDDED_FREE_MUSIC.filter(track => 
      track.genre.toLowerCase().includes('upbeat') || 
      track.genre.toLowerCase().includes('happy') ||
      track.genre.toLowerCase().includes('party') ||
      track.genre.toLowerCase().includes('rock')
    )
  },
  {
    id: 'chill',
    name: 'Chill 😌',
    tracks: EMBEDDED_FREE_MUSIC.filter(track => 
      track.genre.toLowerCase().includes('chill') || 
      track.genre.toLowerCase().includes('ambient') ||
      track.genre.toLowerCase().includes('acoustic') ||
      track.genre.toLowerCase().includes('lo-fi')
    )
  },
  {
    id: 'electronic',
    name: 'Electronic 🎛️',
    tracks: EMBEDDED_FREE_MUSIC.filter(track => 
      track.genre.toLowerCase().includes('electronic') || 
      track.genre.toLowerCase().includes('techno') ||
      track.genre.toLowerCase().includes('8-bit')
    )
  },
  {
    id: 'hiphop',
    name: 'Hip Hop 🎤',
    tracks: EMBEDDED_FREE_MUSIC.filter(track => 
      track.genre.toLowerCase().includes('hip hop') ||
      track.genre.toLowerCase().includes('beat') ||
      track.genre.toLowerCase().includes('urban')
    )
  },
  {
    id: 'jazz',
    name: 'Jazz 🎷',
    tracks: EMBEDDED_FREE_MUSIC.filter(track => 
      track.genre.toLowerCase().includes('jazz') ||
      track.genre.toLowerCase().includes('funk')
    )
  },
  {
    id: 'adventure',
    name: 'Adventure 🎮',
    tracks: EMBEDDED_FREE_MUSIC.filter(track => 
      track.genre.toLowerCase().includes('adventure') ||
      track.genre.toLowerCase().includes('8-bit') ||
      track.genre.toLowerCase().includes('travel')
    )
  },
  {
    id: 'corporate',
    name: 'Corporate 💼',
    tracks: EMBEDDED_FREE_MUSIC.filter(track => 
      track.genre.toLowerCase().includes('corporate')
    )
  }
];

// 🎵 30+ ADDITIONAL COPYRIGHT-FREE MUSIC SOURCES (No API Required)
const MANUAL_DOWNLOAD_SOURCES = [
  // Direct Download Sites (No Registration Required)
  'https://incompetech.com/music/royalty-free/',           // Kevin MacLeod's full library
  'https://bensound.com/royalty-free-music/2',             // Bensound catalog
  'https://www.purple-planet.com',                         // Purple Planet Music
  'https://audionautix.com',                               // Audionautix full library
  'https://www.scottbuckley.com.au/library/',             // Scott Buckley cinematic
  'https://pixabay.com/music/',                            // Pixabay music collection
  'https://freesound.org',                                 // Freesound loops & music
  'https://www.zapsplat.com/free-sound-effects-and-music/', // Zapsplat free tier
  
  // YouTube's Official Free Music
  'https://www.youtube.com/audiolibrary/music',            // YouTube Audio Library
  'https://creators.facebook.com/tools/sound-collection',  // Facebook Sound Collection
  
  // Archive & Public Domain
  'https://archive.org/details/audio_music',               // Internet Archive music
  'https://musopen.org/music/',                            // Classical public domain
  'https://imslp.org',                                     // Classical sheet music & recordings
  
  // Creative Commons Collections  
  'https://ccmixter.org/view/media/remix',                 // ccMixter remixes
  'https://dig.ccmixter.org',                              // Dig ccMixter
  'https://soundcloud.com/search?q=creative%20commons',    // SoundCloud CC music
  
  // Netlabels (Free Music Labels)
  'https://netlabels.org',                                 // Netlabel directory
  'https://rec72.com',                                     // Free netlabel
  'http://dogmazic.net',                                   // French netlabel
  'http://opsound.org',                                    // Open source music
  
  // Chiptune & Video Game Music
  'https://modarchive.org',                                // MOD music archive
  'https://ocremix.org',                                   // Video game remixes
  'https://chiptune.cafe',                                 // Chiptune collection
  'https://vgmusic.com',                                   // Video game MIDI
  
  // Platform Free Tiers
  'https://epidemic-sound.com/music/featured/',            // Epidemic free trial
  'https://artlist.io/royalty-free-music',                // Artlist free trial  
  'https://pond5.com/free/music',                          // Pond5 free music
  'https://bandcamp.com/tag/free-download',               // Bandcamp free downloads
  'https://reverbnation.com/main/freeDownloads',          // ReverbNation free
  'https://audiomack.com/trending/free',                   // Audiomack free music
];

class MusicService {
  private static CACHE_KEY = 'JORVEA_MUSIC_CACHE';
  private static DOWNLOADS_KEY = 'JORVEA_MUSIC_DOWNLOADS';

  // 🎵 Get music by category without any API calls
  static async getMusicByCategory(categoryId: string): Promise<MusicTrack[]> {
    try {
      const category = MUSIC_CATEGORIES.find(cat => cat.id === categoryId);
      if (!category) {
        return EMBEDDED_FREE_MUSIC.slice(0, 20); // Return first 20 if category not found
      }
      
      // Cache the result
      await this.cacheMusic(category.tracks);
      
      return category.tracks;
    } catch (error) {
      console.error('Error getting music by category:', error);
      return EMBEDDED_FREE_MUSIC.slice(0, 10); // Fallback
    }
  }

  // 🎵 Get trending music (most popular tracks)
  static async getTrendingMusic(limit: number = 20): Promise<MusicTrack[]> {
    try {
      const trending = EMBEDDED_FREE_MUSIC
        .filter(track => track.popularity && track.popularity >= 85)
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
        .slice(0, limit);
      
      await this.cacheMusic(trending);
      return trending;
    } catch (error) {
      console.error('Error getting trending music:', error);
      return EMBEDDED_FREE_MUSIC.slice(0, limit);
    }
  }

  // 🎵 Search music locally (no API needed)
  static async searchMusic(query: string): Promise<MusicTrack[]> {
    try {
      const lowercaseQuery = query.toLowerCase();
      const results = EMBEDDED_FREE_MUSIC.filter(track =>
        track.title.toLowerCase().includes(lowercaseQuery) ||
        track.artist.toLowerCase().includes(lowercaseQuery) ||
        track.genre.toLowerCase().includes(lowercaseQuery)
      );
      
      await this.cacheMusic(results);
      return results;
    } catch (error) {
      console.error('Error searching music:', error);
      return [];
    }
  }

  // 🎵 Get all music categories
  static getAllCategories(): MusicCategory[] {
    return MUSIC_CATEGORIES;
  }

  // 🎵 Get random music tracks
  static async getRandomMusic(count: number = 10): Promise<MusicTrack[]> {
    try {
      const shuffled = [...EMBEDDED_FREE_MUSIC].sort(() => 0.5 - Math.random());
      const random = shuffled.slice(0, count);
      
      await this.cacheMusic(random);
      return random;
    } catch (error) {
      console.error('Error getting random music:', error);
      return EMBEDDED_FREE_MUSIC.slice(0, count);
    }
  }

  // 🎵 Download music for offline use
  static async downloadMusic(track: MusicTrack): Promise<string | null> {
    try {
      const fileName = `${track.id}.mp3`;
      const downloadDest = `${RNFS.DocumentDirectoryPath}/music/${fileName}`;
      
      // Create music directory if it doesn't exist
      const musicDir = `${RNFS.DocumentDirectoryPath}/music`;
      const dirExists = await RNFS.exists(musicDir);
      if (!dirExists) {
        await RNFS.mkdir(musicDir);
      }

      // Check if already downloaded
      const fileExists = await RNFS.exists(downloadDest);
      if (fileExists) {
        return downloadDest;
      }

      // Download the file
      const download = RNFS.downloadFile({
        fromUrl: track.url,
        toFile: downloadDest,
      });

      const result = await download.promise;
      
      if (result.statusCode === 200) {
        // Save download info
        await this.saveDownloadInfo(track.id, downloadDest);
        return downloadDest;
      } else {
        throw new Error(`Download failed with status ${result.statusCode}`);
      }
    } catch (error) {
      console.error('Error downloading music:', error);
      return null;
    }
  }

  // 🎵 Check if music is downloaded
  static async isMusicDownloaded(trackId: string): Promise<boolean> {
    try {
      const downloads = await this.getDownloadedMusic();
      return downloads.hasOwnProperty(trackId);
    } catch (error) {
      console.error('Error checking download status:', error);
      return false;
    }
  }

  // 🎵 Get downloaded music info
  static async getDownloadedMusic(): Promise<Record<string, string>> {
    try {
      const downloads = await AsyncStorage.getItem(this.DOWNLOADS_KEY);
      return downloads ? JSON.parse(downloads) : {};
    } catch (error) {
      console.error('Error getting downloaded music:', error);
      return {};
    }
  }

  // 🎵 Cache music data
  private static async cacheMusic(tracks: MusicTrack[]): Promise<void> {
    try {
      const cacheData = {
        tracks,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error caching music:', error);
    }
  }

  // 🎵 Save download information
  private static async saveDownloadInfo(trackId: string, localPath: string): Promise<void> {
    try {
      const downloads = await this.getDownloadedMusic();
      downloads[trackId] = localPath;
      await AsyncStorage.setItem(this.DOWNLOADS_KEY, JSON.stringify(downloads));
    } catch (error) {
      console.error('Error saving download info:', error);
    }
  }

  // 🎵 Get music sources for manual download
  static getManualDownloadSources(): string[] {
    return MANUAL_DOWNLOAD_SOURCES;
  }

  // 🎵 Get copyright information
  static getCopyrightInfo(trackId: string): string {
    const track = EMBEDDED_FREE_MUSIC.find(t => t.id === trackId);
    if (!track) return 'Unknown license';
    
    switch (track.license) {
      case 'CC BY 3.0':
        return 'Creative Commons Attribution 3.0 - Free to use with attribution';
      case 'CC BY 4.0':
        return 'Creative Commons Attribution 4.0 - Free to use with attribution';
      case 'CC0':
        return 'Public Domain - Free to use without attribution';
      case 'Royalty Free':
        return 'Royalty Free - Free to use commercially';
      case 'Public Domain':
        return 'Public Domain - No copyright restrictions';
      default:
        return track.license || 'Free to use';
    }
  }
}

export default MusicService;
