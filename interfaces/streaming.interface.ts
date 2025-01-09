export interface IMovieDetails {
  title: string;
  runtime: number;
  poster_path: string;
}

export interface IStreamingDetails {
  streamingUrl: string;
  quality: string;
  title: string;
  duration: number;
  resumeTime: number;
  subtitles: ISubtitle[];
  supportedQualities: string[];
}

export interface ISubtitle {
  language: string;
  languageName: string;
  url: string;
}

export interface IQuality {
  quality: string;
  bitrate: number;
  available: boolean;
}

export interface IStreamingRequest {
  movieId: number;
  userId: string;
  quality?: "360p" | "480p" | "720p" | "1080p";
}

export type VideoQuality = "360p" | "480p" | "720p" | "1080p";