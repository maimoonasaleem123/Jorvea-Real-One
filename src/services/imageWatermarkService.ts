import { Platform } from 'react-native';

export interface WatermarkOptions {
  text: string;
  fontSize?: number;
  color?: string;
  position?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center';
  opacity?: number;
  fontFamily?: string;
}

export class ImageWatermarkService {
  
  /**
   * Add text watermark to image URI
   * This is a simple implementation that adds metadata
   * For actual image manipulation, you'd need react-native-image-editor or similar
   */
  static async addTextWatermark(
    imageUri: string, 
    options: WatermarkOptions
  ): Promise<{ uri: string; watermarked: boolean; text: string }> {
    
    const watermarkText = options.text || 'Jorvea';
    const timestamp = new Date().toISOString();
    
    try {
      // For now, we'll return the original image with watermark metadata
      // In a real implementation, you'd use a library like react-native-image-editor
      // or send to a backend service for processing
      
      const result = {
        uri: imageUri,
        watermarked: true,
        text: watermarkText,
        timestamp,
        position: options.position || 'bottomRight',
        metadata: {
          originalUri: imageUri,
          watermarkApplied: timestamp,
          watermarkText,
          jorvea: true
        }
      };
      
      console.log('Watermark metadata added:', result.metadata);
      return result;
      
    } catch (error) {
      console.error('Error adding watermark:', error);
      return {
        uri: imageUri,
        watermarked: false,
        text: ''
      };
    }
  }

  /**
   * Create a watermarked filename
   */
  static createWatermarkedFilename(originalFilename: string, watermarkText: string): string {
    const timestamp = Date.now();
    const extension = originalFilename.split('.').pop() || 'jpg';
    const baseName = originalFilename.replace(/\.[^/.]+$/, '');
    
    return `${baseName}_jorvea_${timestamp}.${extension}`;
  }

  /**
   * Validate if image can be watermarked
   */
  static canWatermark(imageUri: string): boolean {
    if (!imageUri) return false;
    
    const supportedFormats = ['.jpg', '.jpeg', '.png', '.webp'];
    const lowercaseUri = imageUri.toLowerCase();
    
    return supportedFormats.some(format => lowercaseUri.includes(format));
  }

  /**
   * Get default watermark options
   */
  static getDefaultOptions(): WatermarkOptions {
    return {
      text: 'Jorvea',
      fontSize: 16,
      color: '#FFFFFF',
      position: 'bottomRight',
      opacity: 0.8,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto'
    };
  }

  /**
   * Generate watermark text based on context
   */
  static generateContextualWatermark(type: 'post' | 'story' | 'reel', username?: string): string {
    const baseText = 'Jorvea';
    const timestamp = new Date().toLocaleDateString();
    
    switch (type) {
      case 'story':
        return username ? `${username} • ${baseText}` : `${baseText} Story`;
      case 'reel':
        return username ? `@${username} on ${baseText}` : `${baseText} Reel`;
      case 'post':
      default:
        return username ? `@${username} • ${baseText}` : baseText;
    }
  }

  /**
   * Apply simple text overlay (metadata only for now)
   */
  static async applySimpleWatermark(
    mediaUri: string,
    type: 'post' | 'story' | 'reel',
    username?: string
  ): Promise<{ uri: string; watermarked: boolean; metadata: any }> {
    
    const watermarkText = this.generateContextualWatermark(type, username);
    const options = this.getDefaultOptions();
    options.text = watermarkText;
    
    try {
      const result = await this.addTextWatermark(mediaUri, options);
      
      return {
        uri: result.uri,
        watermarked: result.watermarked,
        metadata: {
          watermarkText,
          type,
          username,
          timestamp: new Date().toISOString(),
          jorvea: true,
          hasWatermark: true
        }
      };
      
    } catch (error) {
      console.error('Error applying simple watermark:', error);
      return {
        uri: mediaUri,
        watermarked: false,
        metadata: {}
      };
    }
  }
}

export default ImageWatermarkService;
