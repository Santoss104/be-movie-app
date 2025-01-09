import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// Routes
import userRouter from "./routes/user.route";
import subscriptionRouter from './routes/subscription.route';
import movieRouter from "./routes/movie.route";
import watchHistoryRouter from "./routes/watch.history.route.ts"
import stremingRouter from "./routes/streming.route";

dotenv.config();

export const app = express();

// body parser
app.use(express.json({ limit: "50mb" }));

// cookie parser
app.use(cookieParser());

// Konfigurasi CORS
const corsOptions = {
  origin: process.env.FRONTEND_URI || 'http://localhost:3000',
  credentials: true
};

app.use(cors(corsOptions));

// routes
app.use("/api/v1/users", userRouter);
app.use("/api/v1/subscriptions", subscriptionRouter);
app.use("/api/v1/movies", movieRouter);
app.use("/api/v1/history", watchHistoryRouter);
app.use("/api/v1/streaming", stremingRouter);

// testing api
app.get("/test", (req: Request, res: Response, next: NextFunction) => {
  res.status(200).json({
    succcess: true,
    message: "API is working",
  });
});

// unknown route
app.all("*", (req: Request, res: Response, next: NextFunction) => {
  const err = new Error(`Route ${req.originalUrl} not found`) as any;
  err.statusCode = 404;
  next(err);
});