import express from "express";
import {
  getTrendingMovies,
  searchMovies,
  getRecentSearches,
  clearSearchHistory,
  getMovieDetails,
  getMovieRecommendations,
  getMoviesByGenre,
  apiLimiter,
} from "../controllers/movie.controllers";

const movieRouter = express.Router();

movieRouter.use(apiLimiter);

// Movie routes
movieRouter.get("/trending", getTrendingMovies);
movieRouter.get("/search", searchMovies);
movieRouter.get("/recent-searches", getRecentSearches);
movieRouter.delete("/clear-search-history", clearSearchHistory);
movieRouter.get("/genres", getMoviesByGenre);
movieRouter.get("/:movieId", getMovieDetails);
movieRouter.get("/:movieId/recommendations", getMovieRecommendations);

export default movieRouter;