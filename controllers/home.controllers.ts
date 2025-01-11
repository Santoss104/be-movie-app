import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/catchAsynError";
import ErrorHandler from "../utils/error.handler";
import mongoose from "mongoose";
import WatchHistoryModel from "../models/watch.history.models";
import axios from "axios";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_API_KEY = process.env.TMDB_API_KEY;

interface TMDBResponse {
  results: any[];
  total_pages: number;
  total_results: number;
}

export const getHomeScreenData = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return next(new ErrorHandler("User ID is required", 400));
      }

      const [
        continueWatching,
        trendingMovies,
        trendingTVShows,
        forYouMovies,
        animeMovies,
        dramaMovies,
        popularSeries,
      ] = await Promise.all([
        WatchHistoryModel.getContinueWatching(
          new mongoose.Types.ObjectId(userId)
        ),

        // Trending movies
        axios.get<TMDBResponse>(
          `${TMDB_BASE_URL}/trending/movie/day?api_key=${TMDB_API_KEY}`
        ),

        // Trending TV shows
        axios.get<TMDBResponse>(
          `${TMDB_BASE_URL}/trending/tv/day?api_key=${TMDB_API_KEY}`
        ),

        // For you section (personalized recommendations)
        axios.get<TMDBResponse>(
          `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&sort_by=popularity.desc`
        ),

        // Anime movies (using animation genre_id=16)
        axios.get<TMDBResponse>(
          `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=16&sort_by=popularity.desc`
        ),

        // Drama movies (genre_id=18)
        axios.get<TMDBResponse>(
          `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=18&sort_by=popularity.desc`
        ),

        // Popular TV Series
        axios.get<TMDBResponse>(
          `${TMDB_BASE_URL}/tv/popular?api_key=${TMDB_API_KEY}`
        ),
      ]);

      const trending = [
        ...trendingMovies.data.results.map((item) => ({
          ...item,
          mediaType: "movie",
        })),
        ...trendingTVShows.data.results.map((item) => ({
          ...item,
          title: item.name,
          mediaType: "tv",
        })),
      ]
        .sort(() => Math.random() - 0.5)
        .slice(0, 10);

      const response = {
        success: true,
        continueWatching: continueWatching.slice(0, 3),
        trending: trending.map((item) => ({
          id: item.id,
          title: item.title,
          poster_path: item.poster_path
            ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
            : null,
          backdrop_path: item.backdrop_path
            ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
            : null,
          mediaType: item.mediaType,
          genres: item.genre_ids,
          overview: item.overview,
        })),
        forYou: forYouMovies.data.results.slice(0, 5).map((movie) => ({
          id: movie.id,
          title: movie.title,
          poster_path: movie.poster_path
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
            : null,
        })),
        animeMovies: animeMovies.data.results.slice(0, 3).map((movie) => ({
          id: movie.id,
          title: movie.title,
          poster_path: movie.poster_path
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
            : null,
        })),
        dramaMovies: dramaMovies.data.results.slice(0, 3).map((movie) => ({
          id: movie.id,
          title: movie.title,
          poster_path: movie.poster_path
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
            : null,
        })),
        popularSeries: popularSeries.data.results.slice(0, 3).map((show) => ({
          id: show.id,
          title: show.name,
          poster_path: show.poster_path
            ? `https://image.tmdb.org/t/p/w500${show.poster_path}`
            : null,
        })),
      };

      res.set("Cache-Control", "public, max-age=300");
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);