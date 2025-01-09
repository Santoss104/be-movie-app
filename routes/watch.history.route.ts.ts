import express from "express";
import {
  getContinueWatching,
  getRecentlyWatched,
  updateWatchProgress,
} from "../controllers/watch.history.controllers";

const watchHistoryRouter = express.Router();

watchHistoryRouter.get("/continue-watching/:userId", getContinueWatching);
watchHistoryRouter.get("/recently-watched/:userId", getRecentlyWatched);
watchHistoryRouter.post("/update-progress", updateWatchProgress);

export default watchHistoryRouter;