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

interface TMDBMovie {
  id: number;
  title: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  genre_ids: number[];
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
        axios.get<TMDBResponse>(
          `${TMDB_BASE_URL}/trending/movie/day?api_key=${TMDB_API_KEY}`
        ),
        axios.get<TMDBResponse>(
          `${TMDB_BASE_URL}/tv/day?api_key=${TMDB_API_KEY}`
        ),
        axios.get<TMDBResponse>(
          `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&sort_by=popularity.desc`
        ),
        axios.get<TMDBResponse>(
          `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=16&sort_by=popularity.desc`
        ),
        axios.get<TMDBResponse>(
          `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=18&sort_by=popularity.desc`
        ),
        axios.get<TMDBResponse>(
          `${TMDB_BASE_URL}/tv/popular?api_key=${TMDB_API_KEY}`
        ),
      ]);

      // Transform the movie/show data to include necessary fields
      const transformMedia = (item: TMDBMovie, type: "movie" | "tv") => ({
        id: item.id,
        title: type === "movie" ? item.title : item.name,
        poster_path: item.poster_path
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
          : null,
        backdrop_path: item.backdrop_path
          ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
          : null,
        genre_ids: item.genre_ids || [],
        overview: item.overview,
        release_date: item.release_date || item.first_air_date,
        type: type,
        vote_average: item.vote_average,
      });

      const response = {
        success: true,
        continueWatching: continueWatching.slice(0, 3),
        trending: [
          ...trendingMovies.data.results.map((m: TMDBMovie) =>
            transformMedia(m, "movie")
          ),
          ...trendingTVShows.data.results.map((t: TMDBMovie) =>
            transformMedia(t, "tv")
          ),
        ],
        forYou: forYouMovies.data.results.map((m: TMDBMovie) =>
          transformMedia(m, "movie")
        ),
        animeMovies: animeMovies.data.results.map((m: TMDBMovie) =>
          transformMedia(m, "movie")
        ),
        dramaMovies: dramaMovies.data.results.map((m: TMDBMovie) =>
          transformMedia(m, "movie")
        ),
        popularSeries: popularSeries.data.results.map((s: TMDBMovie) =>
          transformMedia(s, "tv")
        ),
      };

      res.set("Cache-Control", "public, max-age=300");
      res.status(200).json(response);
    } catch (error) {
      console.error("Error in getHomeScreenData:", error);
      next(error);
    }
  }
);