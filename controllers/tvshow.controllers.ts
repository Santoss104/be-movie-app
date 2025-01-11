import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import { CatchAsyncError } from "../middleware/catchAsynError";
import ErrorHandler from "../utils/error.handler";
import axios from "axios";
import winston from "winston";
import rateLimit from "express-rate-limit";
import SearchHistoryModel from "models/search.history.models";
import WatchHistoryModel from "models/watch.history.models";
import mongoose from "mongoose";

// Setup logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

dotenv.config();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
if (!TMDB_API_KEY) {
  throw new Error("TMDB_API_KEY is not defined in environment variables");
}

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = {
  poster: "https://image.tmdb.org/t/p/w500",
  backdrop: "https://image.tmdb.org/t/p/original",
  profile: "https://image.tmdb.org/t/p/w185",
};

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

interface ITMDBResponse {
  results: TMDBTVShow[];
  total_pages: number;
  total_results: number;
}

interface TMDBTVShow {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  first_air_date: string;
  vote_average: number;
  genre_ids?: number[];
  genres?: Array<{ id: number; name: string }>;
}

interface PaginationResponse {
  current_page: number;
  total_pages: number;
  total_results: number;
}

const createPaginationResponse = (
  page: number,
  total_pages: number,
  total_results: number
): PaginationResponse => ({
  current_page: Number(page),
  total_pages,
  total_results,
});

const handleAxiosError = (error: unknown, next: NextFunction) => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.status_message || error.message;
    return next(new ErrorHandler(message, status));
  }
  return next(new ErrorHandler((error as Error).message, 500));
};

// Get trending TV shows
export const getTrendingTVShows = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await axios.get<ITMDBResponse>(
        `${TMDB_BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}`
      );

      const tvShows = response.data.results.map((show: TMDBTVShow) => ({
        id: show.id,
        name: show.name,
        poster_path: show.poster_path
          ? `${TMDB_IMAGE_BASE_URL.poster}${show.poster_path}`
          : null,
        backdrop_path: show.backdrop_path
          ? `${TMDB_IMAGE_BASE_URL.backdrop}${show.backdrop_path}`
          : null,
        overview: show.overview,
        first_air_date: show.first_air_date,
        vote_average: show.vote_average,
        genres: show.genre_ids,
      }));

      res.set("Cache-Control", "public, max-age=300");

      res.status(200).json({
        success: true,
        tvShows,
      });
    } catch (error) {
      logger.error("Error in getTrendingTVShows:", { error });
      handleAxiosError(error, next);
    }
  }
);

// Search TV shows
export const searchTVShows = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { query, page = 1 } = req.query;

      if (query && typeof query === "string" && query.trim().length > 0) {
        const userId = req.params.userId;
        await SearchHistoryModel.create({
          userId: new mongoose.Types.ObjectId(userId as string),
          query: query.trim(),
        });

        const response = await axios.get(
          `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${query}&page=${page}`
        );

        const results = response.data.results.map((show: TMDBTVShow) => ({
          id: show.id,
          name: show.name,
          poster_path: show.poster_path
            ? `${TMDB_IMAGE_BASE_URL.poster}${show.poster_path}`
            : null,
          first_air_date: show.first_air_date,
          vote_average: show.vote_average,
        }));

        return res.status(200).json({
          success: true,
          results,
          pagination: {
            current_page: Number(page),
            total_pages: response.data.total_pages,
            total_results: response.data.total_results,
          },
        });
      }

      const response = await axios.get(
        `${TMDB_BASE_URL}/tv/popular?api_key=${TMDB_API_KEY}`
      );

      res.status(200).json({
        success: true,
        popularShows: response.data.results.map((show: TMDBTVShow) => ({
          id: show.id,
          name: show.name,
          poster_path: show.poster_path
            ? `${TMDB_IMAGE_BASE_URL.poster}${show.poster_path}`
            : null,
          backdrop_path: show.backdrop_path
            ? `${TMDB_IMAGE_BASE_URL.backdrop}${show.backdrop_path}`
            : null,
          first_air_date: show.first_air_date,
          vote_average: show.vote_average,
        })),
      });
    } catch (error) {
      logger.error("Error in searchTVShows:", {
        query: req.query.query,
        error,
      });
      handleAxiosError(error, next);
    }
  }
);

// Get TV show details
export const getTVShowDetails = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tvShowId } = req.params;

      if (!tvShowId || isNaN(parseInt(tvShowId))) {
        return next(new ErrorHandler("Valid TV show ID is required", 400));
      }

      const response = await axios.get(
        `${TMDB_BASE_URL}/tv/${tvShowId}?api_key=${TMDB_API_KEY}&append_to_response=videos,credits,content_ratings`
      );

      const tvShow = {
        id: response.data.id,
        name: response.data.name,
        overview: response.data.overview,
        poster_path: response.data.poster_path
          ? `${TMDB_IMAGE_BASE_URL.poster}${response.data.poster_path}`
          : null,
        backdrop_path: response.data.backdrop_path
          ? `${TMDB_IMAGE_BASE_URL.backdrop}${response.data.backdrop_path}`
          : null,
        first_air_date: response.data.first_air_date,
        year: new Date(response.data.first_air_date).getFullYear(),
        number_of_seasons: response.data.number_of_seasons,
        number_of_episodes: response.data.number_of_episodes,
        episode_run_time: response.data.episode_run_time[0],
        status: response.data.status,
        vote_average: response.data.vote_average,
        genres: response.data.genres,
        languages: response.data.spoken_languages.map(
          (lang: any) => lang.english_name
        ),
        videos: response.data.videos.results,
        cast: response.data.credits.cast.map((member: any) => ({
          id: member.id,
          name: member.name,
          character: member.character,
          profile_path: member.profile_path
            ? `${TMDB_IMAGE_BASE_URL.profile}${member.profile_path}`
            : null,
        })),
        crew: {
          creator: response.data.created_by,
          producers: response.data.credits.crew.filter(
            (member: any) => member.job === "Executive Producer"
          ),
        },
        rating:
          response.data.content_ratings.results.find(
            (r: any) => r.iso_3166_1 === "US"
          )?.rating || "N/A",
      };

      res.set("Cache-Control", "public, max-age=3600");
      res.status(200).json({
        success: true,
        tvShow,
      });
    } catch (error) {
      logger.error("Error in getTVShowDetails:", {
        tvShowId: req.params.tvShowId,
        error,
      });
      handleAxiosError(error, next);
    }
  }
);

// Get TV show season details
export const getSeasonDetails = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tvShowId, seasonNumber } = req.params;

      if (!tvShowId || isNaN(parseInt(tvShowId))) {
        return next(new ErrorHandler("Valid TV show ID is required", 400));
      }

      if (!seasonNumber || isNaN(parseInt(seasonNumber))) {
        return next(new ErrorHandler("Valid season number is required", 400));
      }

      const response = await axios.get(
        `${TMDB_BASE_URL}/tv/${tvShowId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`
      );

      const season = {
        id: response.data.id,
        name: response.data.name,
        overview: response.data.overview,
        season_number: response.data.season_number,
        air_date: response.data.air_date,
        episodes: response.data.episodes.map((episode: any) => ({
          id: episode.id,
          name: episode.name,
          overview: episode.overview,
          episode_number: episode.episode_number,
          air_date: episode.air_date,
          still_path: episode.still_path
            ? `${TMDB_IMAGE_BASE_URL.backdrop}${episode.still_path}`
            : null,
          vote_average: episode.vote_average,
        })),
      };

      res.set("Cache-Control", "public, max-age=3600");
      res.status(200).json({
        success: true,
        season,
      });
    } catch (error) {
      logger.error("Error in getSeasonDetails:", {
        tvShowId: req.params.tvShowId,
        seasonNumber: req.params.seasonNumber,
        error,
      });
      handleAxiosError(error, next);
    }
  }
);

// Get TV show recommendations
export const getTVShowRecommendations = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tvShowId } = req.params;

      if (!tvShowId || isNaN(parseInt(tvShowId))) {
        return next(new ErrorHandler("Valid TV show ID is required", 400));
      }

      const response = await axios.get<ITMDBResponse>(
        `${TMDB_BASE_URL}/tv/${tvShowId}/recommendations?api_key=${TMDB_API_KEY}`
      );

      const recommendations = response.data.results.map((show: TMDBTVShow) => ({
        id: show.id,
        name: show.name,
        poster_path: show.poster_path
          ? `${TMDB_IMAGE_BASE_URL.poster}${show.poster_path}`
          : null,
        vote_average: show.vote_average,
      }));

      res.set("Cache-Control", "public, max-age=3600");
      res.status(200).json({
        success: true,
        recommendations,
      });
    } catch (error) {
      logger.error("Error in getTVShowRecommendations:", {
        tvShowId: req.params.tvShowId,
        error,
      });
      handleAxiosError(error, next);
    }
  }
);

// Get New TV Shows (New on MUXX)
export const getNewTVShows = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await axios.get<ITMDBResponse>(
        `${TMDB_BASE_URL}/tv/on_the_air?api_key=${TMDB_API_KEY}`
      );

      const newShows = response.data.results.map((show: TMDBTVShow) => ({
        id: show.id,
        name: show.name,
        poster_path: show.poster_path
          ? `${TMDB_IMAGE_BASE_URL.poster}${show.poster_path}`
          : null,
        backdrop_path: show.backdrop_path
          ? `${TMDB_IMAGE_BASE_URL.backdrop}${show.backdrop_path}`
          : null,
        first_air_date: show.first_air_date,
        vote_average: show.vote_average,
        overview: show.overview,
      }));

      res.set("Cache-Control", "public, max-age=300");
      res.status(200).json({
        success: true,
        newShows,
      });
    } catch (error) {
      logger.error("Error in getNewTVShows:", { error });
      handleAxiosError(error, next);
    }
  }
);

// Get Popular TV Shows
export const getPopularTVShows = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await axios.get<ITMDBResponse>(
        `${TMDB_BASE_URL}/tv/popular?api_key=${TMDB_API_KEY}`
      );

      const popularShows = response.data.results.map((show: TMDBTVShow) => ({
        id: show.id,
        name: show.name,
        poster_path: show.poster_path
          ? `${TMDB_IMAGE_BASE_URL.poster}${show.poster_path}`
          : null,
        backdrop_path: show.backdrop_path
          ? `${TMDB_IMAGE_BASE_URL.backdrop}${show.backdrop_path}`
          : null,
        first_air_date: show.first_air_date,
        vote_average: show.vote_average,
        overview: show.overview,
      }));

      res.set("Cache-Control", "public, max-age=300");
      res.status(200).json({
        success: true,
        popularShows,
      });
    } catch (error) {
      logger.error("Error in getPopularTVShows:", { error });
      handleAxiosError(error, next);
    }
  }
);

// Get TV Shows Tab Data (Combines all TV show data for the TV tab)
export const getTVShowsTabData = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return next(new ErrorHandler("User ID is required", 400));
      }

      const [trending, popular, newShows, continueWatching] = await Promise.all(
        [
          axios.get<ITMDBResponse>(
            `${TMDB_BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}`
          ),
          axios.get<ITMDBResponse>(
            `${TMDB_BASE_URL}/tv/popular?api_key=${TMDB_API_KEY}`
          ),
          axios.get<ITMDBResponse>(
            `${TMDB_BASE_URL}/tv/on_the_air?api_key=${TMDB_API_KEY}`
          ),
          WatchHistoryModel.getContinueWatching(
            new mongoose.Types.ObjectId(userId),
            "tv",
            10
          ),
        ]
      );

      const response = {
        trending: trending.data.results.map((show: TMDBTVShow) => ({
          id: show.id,
          name: show.name,
          poster_path: show.poster_path
            ? `${TMDB_IMAGE_BASE_URL.poster}${show.poster_path}`
            : null,
          backdrop_path: show.backdrop_path
            ? `${TMDB_IMAGE_BASE_URL.backdrop}${show.backdrop_path}`
            : null,
          first_air_date: show.first_air_date,
          vote_average: show.vote_average,
        })),
        popular: popular.data.results.map((show: TMDBTVShow) => ({
          id: show.id,
          name: show.name,
          poster_path: show.poster_path
            ? `${TMDB_IMAGE_BASE_URL.poster}${show.poster_path}`
            : null,
          backdrop_path: show.backdrop_path
            ? `${TMDB_IMAGE_BASE_URL.backdrop}${show.backdrop_path}`
            : null,
          first_air_date: show.first_air_date,
          vote_average: show.vote_average,
        })),
        newShows: newShows.data.results.map((show: TMDBTVShow) => ({
          id: show.id,
          name: show.name,
          poster_path: show.poster_path
            ? `${TMDB_IMAGE_BASE_URL.poster}${show.poster_path}`
            : null,
          backdrop_path: show.backdrop_path
            ? `${TMDB_IMAGE_BASE_URL.backdrop}${show.backdrop_path}`
            : null,
          first_air_date: show.first_air_date,
          vote_average: show.vote_average,
        })),
        continueWatching,
      };

      res.set("Cache-Control", "public, max-age=300");
      res.status(200).json({
        success: true,
        ...response,
      });
    } catch (error) {
      logger.error("Error in getTVShowsTabData:", { error });
      handleAxiosError(error, next);
    }
  }
);

// Get TV shows by genre
export const getTVShowsByGenre = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { genreId, page = 1 } = req.query;

      if (!genreId || typeof genreId !== "string" || isNaN(parseInt(genreId))) {
        return next(new ErrorHandler("Valid genre ID is required", 400));
      }

      const pageNum = parseInt(page as string);
      if (isNaN(pageNum) || pageNum < 1) {
        return next(new ErrorHandler("Invalid page number", 400));
      }

      const response = await axios.get<ITMDBResponse>(
        `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=${genreId}&page=${pageNum}`
      );

      const tvShows = response.data.results.map((show: TMDBTVShow) => ({
        id: show.id,
        name: show.name,
        poster_path: show.poster_path
          ? `${TMDB_IMAGE_BASE_URL.poster}${show.poster_path}`
          : null,
        overview: show.overview,
        first_air_date: show.first_air_date,
        vote_average: show.vote_average,
      }));

      res.set("Cache-Control", "public, max-age=300");
      res.status(200).json({
        success: true,
        tvShows,
        pagination: createPaginationResponse(
          pageNum,
          response.data.total_pages,
          response.data.total_results
        ),
      });
    } catch (error) {
      logger.error("Error in getTVShowsByGenre:", {
        genreId: req.query.genreId,
        page: req.query.page,
        error,
      });
      handleAxiosError(error, next);
    }
  }
);