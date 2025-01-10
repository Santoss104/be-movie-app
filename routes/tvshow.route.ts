import express from "express";
import {
  getTrendingTVShows,
  searchTVShows,
  getTVShowDetails,
  getSeasonDetails,
  getTVShowRecommendations,
  getTVShowsByGenre,
  getPopularTVShows,
  getNewTVShows,
  getTVShowsTabData,
  apiLimiter,
} from "../controllers/tvshow.controllers";

const tvShowRouter = express.Router();

tvShowRouter.use(apiLimiter);

// TV Show routes
tvShowRouter.get("/trending", getTrendingTVShows);
tvShowRouter.get("/popular", getPopularTVShows);
tvShowRouter.get("/new", getNewTVShows);
tvShowRouter.get("/search", searchTVShows);
tvShowRouter.get("/genres", getTVShowsByGenre);
tvShowRouter.get("/tab-data/:userId", getTVShowsTabData);
tvShowRouter.get("/:tvShowId", getTVShowDetails);
tvShowRouter.get("/:tvShowId/recommendations", getTVShowRecommendations);
tvShowRouter.get("/:tvShowId/season/:seasonNumber", getSeasonDetails);

export default tvShowRouter;