import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/catchAsynError";
import ErrorHandler from "../utils/error.handler";
import mongoose from "mongoose";
import WatchHistoryModel from "../models/watch.history.models";

// Get continue watching list
export const getContinueWatching = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.params;

    if (!userId) {
      return next(new ErrorHandler("User ID is required", 400));
    }

    const continueWatching = await WatchHistoryModel.getContinueWatching(
      new mongoose.Types.ObjectId(userId)
    );

    res.status(200).json({
      success: true,
      continueWatching,
    });
  }
);

// Get recently watched
export const getRecentlyWatched = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.params;

    if (!userId) {
      return next(new ErrorHandler("User ID is required", 400));
    }

    const recentlyWatched = await WatchHistoryModel.getUserHistory(
      new mongoose.Types.ObjectId(userId),
      10
    );

    res.status(200).json({
      success: true,
      recentlyWatched,
    });
  }
);

// Update watch progress
export const updateWatchProgress = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId, movieId, currentTime, duration } = req.body;

    if (!userId || !movieId || currentTime === undefined || !duration) {
      return next(new ErrorHandler("Missing required parameters", 400));
    }

    const watchHistory = await WatchHistoryModel.updateWatchProgress(
      new mongoose.Types.ObjectId(userId),
      movieId,
      currentTime,
      duration
    );

    res.status(200).json({
      success: true,
      watchHistory,
    });
  }
);