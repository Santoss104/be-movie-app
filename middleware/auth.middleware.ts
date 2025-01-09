import { Request, Response, NextFunction } from "express";
import ErrorHandler from "../utils/error.handler";
import { CatchAsyncError } from "./catchAsynError";

// Validate subscription plan type
export const validateSubscriptionData = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { planType } = req.body;

    if (!planType || !["monthly", "yearly"].includes(planType)) {
      return next(new ErrorHandler("Invalid subscription plan type", 400));
    }

    next();
  }
);

// Validate user role
export const checkUserRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { role } = req.body;

    if (!role || !allowedRoles.includes(role)) {
      return next(
        new ErrorHandler(
          `Role: ${role} is not allowed to access this resource`,
          403
        )
      );
    }
    next();
  };
};