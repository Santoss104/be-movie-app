import express from "express";
import { getHomeScreenData } from "../controllers/home.controllers";
import { apiLimiter } from "../controllers/movie.controllers";

const homeRouter = express.Router();

homeRouter.use(apiLimiter);

homeRouter.get("/:userId", getHomeScreenData);

export default homeRouter;