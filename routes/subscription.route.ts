import express from "express";
import {
  createSubscription,
  processSubscriptionPayment,
  getSubscriptionStatus,
} from "../controllers/subscription.controllers";
import { validateSubscriptionData } from "../middleware/auth.middleware";


const subscriptionRouter = express.Router();

subscriptionRouter.post(
  "/create",
  validateSubscriptionData,
  createSubscription
);
subscriptionRouter.post("/payment", processSubscriptionPayment);
subscriptionRouter.get("/status/:id", getSubscriptionStatus);

export default subscriptionRouter;