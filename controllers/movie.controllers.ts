import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import { CatchAsyncError } from "../middleware/catchAsynError";
import ErrorHandler from "../utils/error.handler";
import axios, { AxiosError } from "axios";
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
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

interface TMDBMovie {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date: string;
  vote_average: number;
  genre_ids?: number[];
  genres?: Array<{ id: number; name: string }>;
}

interface PaginationResponse {
  current_page: number;
  total_pages: number;
  total_results: number;
}

// Helper functions
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

// Get trending movies
export const getTrendingMovies = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await axios.get<ITMDBResponse>(
        `${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}`
      );

      const movies = response.data.results.map((movie: TMDBMovie) => ({
        id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path
          ? `${TMDB_IMAGE_BASE_URL.poster}${movie.poster_path}`
          : null,
        backdrop_path: movie.backdrop_path
          ? `${TMDB_IMAGE_BASE_URL.backdrop}${movie.backdrop_path}`
          : null,
        overview: movie.overview,
        release_date: movie.release_date,
        vote_average: movie.vote_average,
        genres: movie.genre_ids,
      }));

      res.set("Cache-Control", "public, max-age=300");

      res.status(200).json({
        success: true,
        movies,
      });
    } catch (error) {
      logger.error("Error in getTrendingMovies:", { error });
      handleAxiosError(error, next);
    }
  }
);

// Search movies
export const searchMovies = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { query, page = 1 } = req.query;

      // Validasi query
      if (query && typeof query === "string" && query.trim().length > 0) {
            const userId = req.params.userId;
              await SearchHistoryModel.create({
                userId: new mongoose.Types.ObjectId(userId as string),
                query: query.trim(),
              });
            const response = await axios.get(
              `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${query}&page=${page}`
            );

        const results = response.data.results
          .map((item: any) => {
            switch (item.media_type) {
              case "movie":
                return {
                  id: item.id,
                  type: "movie",
                  title: item.title,
                  poster_path: item.poster_path
                    ? `${TMDB_IMAGE_BASE_URL.poster}${item.poster_path}`
                    : null,
                  release_date: item.release_date,
                  vote_average: item.vote_average,
                };
              case "person":
                return {
                  id: item.id,
                  type: "person",
                  name: item.name,
                  profile_path: item.profile_path
                    ? `${TMDB_IMAGE_BASE_URL.profile}${item.profile_path}`
                    : null,
                  known_for: item.known_for,
                };
              default:
                return null;
            }
          })
          .filter(Boolean);

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

      const [popularActors, trending] = await Promise.all([
        axios.get(`${TMDB_BASE_URL}/person/popular?api_key=${TMDB_API_KEY}`),
        axios.get(
          `${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}`
        ),
      ]);

      res.status(200).json({
        success: true,
        popularActors: popularActors.data.results.map((actor: any) => ({
          id: actor.id,
          name: actor.name,
          profile_path: actor.profile_path
            ? `${TMDB_IMAGE_BASE_URL.profile}${actor.profile_path}`
            : null,
          known_for: actor.known_for_department,
        })),
        recommended: trending.data.results.map((movie: any) => ({
          id: movie.id,
          title: movie.title,
          poster_path: movie.poster_path
            ? `${TMDB_IMAGE_BASE_URL.poster}${movie.poster_path}`
            : null,
          backdrop_path: movie.backdrop_path
            ? `${TMDB_IMAGE_BASE_URL.backdrop}${movie.backdrop_path}`
            : null,
          release_date: movie.release_date,
          vote_average: movie.vote_average,
        })),
      });
    } catch (error) {
      logger.error("Error in searchMovies:", { query: req.query.query, error });
      handleAxiosError(error, next);
    }
  }
);

// Recent searches
export const getRecentSearches = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.query;

      if (!userId) {
        return next(new ErrorHandler("User ID is required", 400));
      }

      const recentSearches = await SearchHistoryModel.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId as string),
          },
        },
        {
          $group: {
            _id: "$query",
            lastSearched: { $max: "$timestamp" },
          },
        },
        {
          $sort: {
            lastSearched: -1,
          },
        },
        {
          $limit: 5,
        },
        {
          $project: {
            _id: 0,
            query: "$_id",
            timestamp: "$lastSearched",
          },
        },
      ]);

      res.status(200).json({
        success: true,
        recentSearches,
      });
    } catch (error) {
      logger.error("Error in getRecentSearches:", {
        userId: req.query.userId,
        error,
      });
      handleAxiosError(error, next);
    }
  }
);

// Clear Search
export const clearSearchHistory = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return next(new ErrorHandler("User ID is required", 400));
      }

      await SearchHistoryModel.deleteMany({
        userId: new mongoose.Types.ObjectId(userId),
      });

      res.status(200).json({
        success: true,
        message: "Search history cleared successfully",
      });
    } catch (error) {
      logger.error("Error in clearSearchHistory:", {
        userId: req.body.userId,
        error,
      });
      handleAxiosError(error, next);
    }
  }
);

// Get movie details
export const getMovieDetails = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { movieId } = req.params;

      if (!movieId || isNaN(parseInt(movieId))) {
        return next(new ErrorHandler("Valid movie ID is required", 400));
      }

      const response = await axios.get(
        `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=videos,credits,release_dates`
      );

      const movie = {
        id: response.data.id,
        title: response.data.title,
        overview: response.data.overview,
        poster_path: response.data.poster_path
          ? `${TMDB_IMAGE_BASE_URL.poster}${response.data.poster_path}`
          : null,
        backdrop_path: response.data.backdrop_path
          ? `${TMDB_IMAGE_BASE_URL.backdrop}${response.data.backdrop_path}`
          : null,
        release_date: response.data.release_date,
        year: new Date(response.data.release_date).getFullYear(),
        runtime: response.data.runtime,
        runtime_formatted: `${Math.floor(response.data.runtime / 60)}h ${
          response.data.runtime % 60
        }min`,
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
            ? `${TMDB_IMAGE_BASE_URL.poster}${member.profile_path}`
            : null,
        })),
        crew: {
          director: response.data.credits.crew.find(
            (member: any) => member.job === "Director"
          ),
          writer: response.data.credits.crew.filter(
            (member: any) =>
              member.job === "Writer" || member.job === "Screenplay"
          ),
          dop: response.data.credits.crew.find(
            (member: any) => member.job === "Director of Photography"
          ),
        },
        rating:
          response.data.release_dates.results.find(
            (r: any) => r.iso_3166_1 === "US"
          )?.release_dates[0]?.certification || "N/A",
      };

      res.set("Cache-Control", "public, max-age=3600");
      res.status(200).json({
        success: true,
        movie,
      });
    } catch (error) {
      logger.error("Error in getMovieDetails:", {
        movieId: req.params.movieId,
        error,
      });
      handleAxiosError(error, next);
    }
  }
);

// Get movie recommendations
export const getMovieRecommendations = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { movieId } = req.params;

      if (!movieId || isNaN(parseInt(movieId))) {
        return next(new ErrorHandler("Valid movie ID is required", 400));
      }

      const response = await axios.get<ITMDBResponse>(
        `${TMDB_BASE_URL}/movie/${movieId}/recommendations?api_key=${TMDB_API_KEY}`
      );

      const recommendations = response.data.results.map((movie: TMDBMovie) => ({
        id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path
          ? `${TMDB_IMAGE_BASE_URL.poster}${movie.poster_path}`
          : null,
        vote_average: movie.vote_average,
      }));

      res.set("Cache-Control", "public, max-age=3600");

      res.status(200).json({
        success: true,
        recommendations,
      });
    } catch (error) {
      logger.error("Error in getMovieRecommendations:", {
        movieId: req.params.movieId,
        error,
      });
      handleAxiosError(error, next);
    }
  }
);

// Get popular movies by genre
export const getMoviesByGenre = CatchAsyncError(
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
        `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${genreId}&page=${pageNum}`
      );

      const movies = response.data.results.map((movie: TMDBMovie) => ({
        id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path
          ? `${TMDB_IMAGE_BASE_URL.poster}${movie.poster_path}`
          : null,
        overview: movie.overview,
        release_date: movie.release_date,
        vote_average: movie.vote_average,
      }));

      // Set cache headers
      res.set("Cache-Control", "public, max-age=300");

      res.status(200).json({
        success: true,
        movies,
        pagination: createPaginationResponse(
          pageNum,
          response.data.total_pages,
          response.data.total_results
        ),
      });
    } catch (error) {
      logger.error("Error in getMoviesByGenre:", {
        genreId: req.query.genreId,
        page: req.query.page,
        error,
      });
      handleAxiosError(error, next);
    }
  }
);

// Get New Movies (New on MUXX)
export const getNewMovies = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await axios.get<ITMDBResponse>(
        `${TMDB_BASE_URL}/movie/now_playing?api_key=${TMDB_API_KEY}`
      );

      const newMovies = response.data.results.map((movie: TMDBMovie) => ({
        id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path
          ? `${TMDB_IMAGE_BASE_URL.poster}${movie.poster_path}`
          : null,
        backdrop_path: movie.backdrop_path
          ? `${TMDB_IMAGE_BASE_URL.backdrop}${movie.backdrop_path}`
          : null,
        release_date: movie.release_date,
        vote_average: movie.vote_average,
        overview: movie.overview,
      }));

      res.set("Cache-Control", "public, max-age=300");
      res.status(200).json({
        success: true,
        newMovies,
      });
    } catch (error) {
      logger.error("Error in getNewMovies:", { error });
      handleAxiosError(error, next);
    }
  }
);

// Get Popular Movies
export const getPopularMovies = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await axios.get<ITMDBResponse>(
        `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}`
      );

      const popularMovies = response.data.results.map((movie: TMDBMovie) => ({
        id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path
          ? `${TMDB_IMAGE_BASE_URL.poster}${movie.poster_path}`
          : null,
        backdrop_path: movie.backdrop_path
          ? `${TMDB_IMAGE_BASE_URL.backdrop}${movie.backdrop_path}`
          : null,
        release_date: movie.release_date,
        vote_average: movie.vote_average,
        overview: movie.overview,
      }));

      res.set("Cache-Control", "public, max-age=300");
      res.status(200).json({
        success: true,
        popularMovies,
      });
    } catch (error) {
      logger.error("Error in getPopularMovies:", { error });
      handleAxiosError(error, next);
    }
  }
);

// Get Movies Tab Data (Combines all movie data for the Movies tab)
export const getMoviesTabData = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return next(new ErrorHandler("User ID is required", 400));
      }

      const [trending, popular, newMovies, continueWatching] =
        await Promise.all([
          axios.get<ITMDBResponse>(
            `${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}`
          ),
          axios.get<ITMDBResponse>(
            `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}`
          ),
          axios.get<ITMDBResponse>(
            `${TMDB_BASE_URL}/movie/now_playing?api_key=${TMDB_API_KEY}`
          ),
          WatchHistoryModel.getContinueWatching(
            new mongoose.Types.ObjectId(userId),
            "movie",
            10 // Menambahkan limit sebagai parameter ketiga
          ),
        ]);

      const response = {
        trending: trending.data.results.map((movie: TMDBMovie) => ({
          id: movie.id,
          title: movie.title,
          poster_path: movie.poster_path
            ? `${TMDB_IMAGE_BASE_URL.poster}${movie.poster_path}`
            : null,
          backdrop_path: movie.backdrop_path
            ? `${TMDB_IMAGE_BASE_URL.backdrop}${movie.backdrop_path}`
            : null,
          release_date: movie.release_date,
          vote_average: movie.vote_average,
        })),
        popular: popular.data.results.map((movie: TMDBMovie) => ({
          id: movie.id,
          title: movie.title,
          poster_path: movie.poster_path
            ? `${TMDB_IMAGE_BASE_URL.poster}${movie.poster_path}`
            : null,
          backdrop_path: movie.backdrop_path
            ? `${TMDB_IMAGE_BASE_URL.backdrop}${movie.backdrop_path}`
            : null,
          release_date: movie.release_date,
          vote_average: movie.vote_average,
        })),
        newMovies: newMovies.data.results.map((movie: TMDBMovie) => ({
          id: movie.id,
          title: movie.title,
          poster_path: movie.poster_path
            ? `${TMDB_IMAGE_BASE_URL.poster}${movie.poster_path}`
            : null,
          backdrop_path: movie.backdrop_path
            ? `${TMDB_IMAGE_BASE_URL.backdrop}${movie.backdrop_path}`
            : null,
          release_date: movie.release_date,
          vote_average: movie.vote_average,
        })),
        continueWatching,
      };

      res.set("Cache-Control", "public, max-age=300");
      res.status(200).json({
        success: true,
        ...response,
      });
    } catch (error) {
      logger.error("Error in getMoviesTabData:", { error });
      handleAxiosError(error, next);
    }
  }
);