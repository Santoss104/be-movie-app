import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/catchAsynError";
import ErrorHandler from "../utils/error.handler";
import axios from "axios";
import WatchHistoryModel from "../models/watch.history.models";
import mongoose from "mongoose";
import { StreamingService } from "../services/streaming.services";

interface IStreamingRequest {
  movieId: number;
  userId: string;
  quality?: "360p" | "480p" | "720p" | "1080p";
}

// Get streaming URL and details
export const getStreamingDetails = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      movieId,
      userId,
      quality = "720p",
    } = req.query as unknown as IStreamingRequest;

    if (!movieId || !userId) {
      return next(new ErrorHandler("Movie ID and User ID are required", 400));
    }

    // Get TMDB movie details
    const tmdbResponse = await axios
      .get(
        `https://api.themoviedb.org/3/movie/${movieId}?api_key=${process.env.TMDB_API_KEY}`
      )
      .catch(() => null);

    if (!tmdbResponse || !tmdbResponse.data) {
      return next(new ErrorHandler("Movie details not found", 404));
    }

    // Get or create watch history
    let watchHistory = await WatchHistoryModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      movieId,
    });

    // If no watch history exists, create a new one
    if (!watchHistory) {
      watchHistory = await WatchHistoryModel.create({
        userId: new mongoose.Types.ObjectId(userId),
        movieId,
        currentTime: 0,
        completed: false,
        lastWatched: new Date(),
      });
    }

    // Get streaming details from service
    const streamingDetails = await StreamingService.getStreamingDetails(
      movieId,
      quality,
      tmdbResponse.data,
      watchHistory.currentTime || 0
    );

    if (!streamingDetails) {
      return next(new ErrorHandler("Streaming details not found", 404));
    }

    res.status(200).json({
      success: true,
      streamingDetails,
    });
  }
);

// Get supported video qualities
export const getVideoQualities = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { movieId } = req.params;

    if (!movieId) {
      return next(new ErrorHandler("Movie ID is required", 400));
    }

    // Convert movieId to number and validate
    const movieIdNumber = parseInt(movieId);
    if (isNaN(movieIdNumber)) {
      return next(new ErrorHandler("Invalid Movie ID format", 400));
    }

    // Call the service to get supported qualities
    const qualities = await StreamingService.getSupportedQualities(
      movieIdNumber
    );

    // Handle case when no qualities are found
    if (!qualities || qualities.length === 0) {
      return next(
        new ErrorHandler("No video qualities found for this movie", 404)
      );
    }

    res.status(200).json({
      success: true,
      qualities,
    });
  }
);

export const updateWatchProgress = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId, movieId, currentTime, duration } = req.body;

    if (!userId || !movieId || currentTime === undefined) {
      return next(new ErrorHandler("Missing required fields", 400));
    }

    try {
      const watchHistory = await WatchHistoryModel.findOneAndUpdate(
        {
          userId: new mongoose.Types.ObjectId(userId),
          movieId: Number(movieId),
        },
        {
          $set: {
            currentTime,
            duration,
            lastWatched: new Date(),
            completed: currentTime >= duration,
          },
        },
        { upsert: true, new: true }
      );

      res.status(200).json({
        success: true,
        watchHistory,
      });
    } catch (error) {
      return next(new ErrorHandler("Error updating watch progress", 500));
    }
  }
);