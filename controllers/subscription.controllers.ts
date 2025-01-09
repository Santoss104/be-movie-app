import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/catchAsynError";
import ErrorHandler from "../utils/error.handler";
import SubscriptionModel from "../models/subscription.models";
import { v4 as uuidv4 } from "uuid";
import { PaymentUtils } from "../utils/payment";
import { ICreditCard } from "../interfaces/card.interface";

// Create subscription
export const createSubscription = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { planType } = req.body;

      // Validasi tipe plan
      if (!planType || !["monthly", "yearly"].includes(planType)) {
        return next(new ErrorHandler("Invalid subscription plan type", 400));
      }

      const price = planType === "monthly" ? 149999 : 1619999;
      const endDate = new Date();

      if (planType === "monthly") {
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      const subscription = await SubscriptionModel.create({
        planType,
        price,
        startDate: new Date(),
        endDate,
        status: "inactive",
        paymentStatus: "pending",
      });

      res.status(200).json({
        success: true,
        subscription: {
          id: subscription._id,
          planType: subscription.planType,
          price: subscription.price,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          status: subscription.status,
        },
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Process payment
export const processSubscriptionPayment = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        cardNumber,
        cardholderName,
        expiryMonth,
        expiryYear,
        cvv,
        subscriptionId,
      } = req.body;

      // Input validation (basic checks)
      if (
        !cardNumber ||
        !cardholderName ||
        !expiryMonth ||
        !expiryYear ||
        !cvv ||
        !subscriptionId
      ) {
        res.status(400).json({
          success: false,
          message: "All payment fields are required",
        });
        return;
      }

      // Relax card format validation for demo
      if (cardNumber.length !== 16 || !/^\d+$/.test(cardNumber)) {
        res.status(400).json({
          success: false,
          message: "Card number must be 16 digits",
        });
        return;
      }

      if (cvv.length !== 3 || !/^\d+$/.test(cvv)) {
        res.status(400).json({
          success: false,
          message: "CVV must be 3 digits",
        });
        return;
      }

      // Expiry validation (allow future dates)
      const today = new Date();
      const expiry = new Date(expiryYear, expiryMonth - 1);
      if (expiry < today) {
        res.status(400).json({
          success: false,
          message: "Card has expired",
        });
        return;
      }

      // Simulate subscription check
      const subscription = await SubscriptionModel.findById(subscriptionId);
      if (!subscription) {
        res.status(404).json({
          success: false,
          message: "Subscription not found",
        });
        return;
      }

      if (subscription.paymentStatus === "completed") {
        res.status(400).json({
          success: false,
          message: "Subscription already paid",
        });
        return;
      }

      // Simulate payment processing
      const paymentResult = {
        success: true,
        paymentVerificationId: uuidv4(), // Buat ID unik untuk verifikasi pembayaran
      };

      if (!paymentResult.success) {
        res.status(400).json({
          success: false,
          message: "Payment failed",
        });
        return;
      }

      // Update subscription after successful payment
      subscription.paymentStatus = "completed";
      subscription.status = "active";
      subscription.paymentVerificationId = paymentResult.paymentVerificationId;
      await subscription.save();

      console.log(
        `Payment successful for subscription: ${subscriptionId}, verification: ${paymentResult.paymentVerificationId}`
      );

      res.setHeader("Content-Type", "application/json");
      res.status(200).json({
        success: true,
        message: "Payment processed successfully",
        subscription: {
          id: subscription._id,
          status: subscription.status,
          planType: subscription.planType,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          price: subscription.price,
          paymentVerificationId: subscription.paymentVerificationId,
        },
      });
    } catch (error: any) {
      console.error("Payment processing error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Payment processing failed",
      });
    }
  }
);

// Get subscription status (optional tapi berguna)
export const getSubscriptionStatus = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const subscription = await SubscriptionModel.findById(req.params.id);

      if (!subscription) {
        return next(new ErrorHandler("Subscription not found", 404));
      }

      res.status(200).json({
        success: true,
        subscription: {
          id: subscription._id,
          status: subscription.status,
          planType: subscription.planType,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          price: subscription.price,
          paymentStatus: subscription.paymentStatus,
        },
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);