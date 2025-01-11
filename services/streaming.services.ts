import axios from "axios";
import {
  IMovieDetails,
  IStreamingDetails,
  ISubtitle,
  IQuality,
  VideoQuality,
} from "../interfaces/streaming.interface";
import  dotenv  from 'dotenv';

dotenv.config();

export class StreamingService {
  private static readonly SUPPORTED_QUALITIES: VideoQuality[] = [
    "360p",
    "480p",
    "720p",
    "1080p",
  ];
  private static readonly BITRATE_MAP: Record<VideoQuality, number> = {
    "360p": 800,
    "480p": 1500,
    "720p": 2500,
    "1080p": 4500,
  };

  static async getStreamingDetails(
    movieId: number,
    quality: VideoQuality,
    movieDetails: IMovieDetails,
    resumeTime: number = 0
  ): Promise<IStreamingDetails> {
    const streamingUrl = await this.generateStreamingUrl(movieId, quality);
    const subtitles = await this.getSubtitles(movieId);

    return {
      streamingUrl,
      quality,
      title: movieDetails.title,
      duration: movieDetails.runtime * 60,
      resumeTime,
      subtitles,
      supportedQualities: this.SUPPORTED_QUALITIES,
    };
  }

  static async getSupportedQualities(movieId: number): Promise<IQuality[]> {
    return this.SUPPORTED_QUALITIES.map((quality) => ({
      quality,
      bitrate: this.BITRATE_MAP[quality],
      available: true,
    }));
  }

  private static async generateStreamingUrl(
    movieId: number,
    quality: VideoQuality
  ): Promise<string> {
    return `https://your-streaming-service.com/stream/${movieId}?quality=${quality}`;
  }

  private static async getSubtitles(movieId: number): Promise<ISubtitle[]> {
    try {
      const response = await axios.get(
        `https://api.themoviedb.org/3/movie/${movieId}/translations?api_key=${process.env.TMDB_API_KEY}`
      );

      return response.data.translations.slice(0, 5).map((trans: any) => ({
        language: trans.iso_639_1,
        languageName: trans.english_name,
        url: `https://your-subtitle-service.com/subtitles/${movieId}/${trans.iso_639_1}.vtt`,
      }));
    } catch (error) {
      return [];
    }
  }

  static getBitrateForQuality(quality: VideoQuality): number {
    return this.BITRATE_MAP[quality] || this.BITRATE_MAP["720p"];
  }
}