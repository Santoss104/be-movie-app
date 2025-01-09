import express from "express";
import {
  getStreamingDetails,
  getVideoQualities,
} from "../controllers/streaming.controllers";

const stremingRouter = express.Router();

stremingRouter.get("/stream", getStreamingDetails);
stremingRouter.get("/qualities/:movieId", getVideoQualities);

export default stremingRouter;