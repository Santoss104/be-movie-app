import express from "express";
import {
  getStreamingDetails,
  getVideoQualities,
  updateWatchProgress,
} from "../controllers/streaming.controllers";

const stremingRouter = express.Router();

stremingRouter.get("/stream", getStreamingDetails);
stremingRouter.get("/qualities/:movieId", getVideoQualities);
stremingRouter.post("/progress", updateWatchProgress);

export default stremingRouter;