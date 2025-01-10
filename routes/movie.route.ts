import express from "express";
import {
  getTrendingMovies,
  getNewMovies,
  getPopularMovies,
  searchMovies,
  getRecentSearches,
  clearSearchHistory,
  getMoviesTabData,
  getMovieDetails,
  getMovieRecommendations,
  getMoviesByGenre,
  apiLimiter,
} from "../controllers/movie.controllers";

const movieRouter = express.Router();

movieRouter.use(apiLimiter);

// Movie routes
movieRouter.get("/trending", getTrendingMovies);
movieRouter.get("/popular", getPopularMovies);
movieRouter.get("/new", getNewMovies);
movieRouter.get("/search", searchMovies);
movieRouter.get("/recent-searches", getRecentSearches);
movieRouter.delete("/clear-search-history", clearSearchHistory);
movieRouter.get("/genres", getMoviesByGenre);
movieRouter.get("/tab-data/:userId", getMoviesTabData);
movieRouter.get("/:movieId", getMovieDetails);
movieRouter.get("/:movieId/recommendations", getMovieRecommendations);

export default movieRouter;