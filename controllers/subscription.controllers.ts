import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/catchAsynError";
import ErrorHandler from "../utils/error.handler";
import SubscriptionModel from "../models/subscription.models";
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

      // Validasi input pembayaran
      if (
        !cardNumber ||
        !cardholderName ||
        !expiryMonth ||
        !expiryYear ||
        !cvv ||
        !subscriptionId
      ) {
        return next(new ErrorHandler("All payment fields are required", 400));
      }

      // Validasi format kartu
      if (cardNumber.length < 15 || cardNumber.length > 16) {
        return next(new ErrorHandler("Invalid card number", 400));
      }

      if (cvv.length < 3 || cvv.length > 4) {
        return next(new ErrorHandler("Invalid CVV", 400));
      }

      // Validasi expiry date
      const today = new Date();
      const expiry = new Date(expiryYear, expiryMonth - 1);
      if (expiry < today) {
        return next(new ErrorHandler("Card has expired", 400));
      }

      // Cek subscription
      const subscription = await SubscriptionModel.findById(subscriptionId);
      if (!subscription) {
        return next(new ErrorHandler("Subscription not found", 404));
      }

      // Cek status pembayaran
      if (subscription.paymentStatus === "completed") {
        return next(new ErrorHandler("Subscription already paid", 400));
      }

      // Siapkan data kartu untuk pembayaran
      const cardDetails: ICreditCard = {
        cardNumber,
        cardholderName,
        expiryMonth,
        expiryYear,
        cvv,
      };

      // Log pembayaran (dengan data yang sudah dibersihkan)
      const sanitizedCardDetails = {
        ...cardDetails,
        cardNumber: `****${cardDetails.cardNumber.slice(-4)}`,
        cvv: "***",
      };
      console.log("Processing payment with:", sanitizedCardDetails);

      // Proses pembayaran
      const paymentResult = await PaymentUtils.processPayment(
        cardDetails,
        subscription.price
      );

      // Handle payment errors
      if (!paymentResult.success) {
        let errorMessage = "Payment failed";
        let errorCode = 400;

        switch (paymentResult.error) {
          case "CARD_DECLINED":
            errorMessage = "Card was declined";
            break;
          case "INSUFFICIENT_FUNDS":
            errorMessage = "Insufficient funds";
            break;
          case "INVALID_CARD":
            errorMessage = "Invalid card details";
            break;
          case "PAYMENT_ERROR":
            errorMessage = "Payment processing error";
            errorCode = 500;
            break;
          default:
            errorMessage = paymentResult.error || "Payment processing error";
        }

        console.error(
          `Payment failed for subscription ${subscriptionId}:`,
          paymentResult.error
        );
        return next(new ErrorHandler(errorMessage, errorCode));
      }

      // Update subscription setelah pembayaran berhasil
      subscription.paymentStatus = "completed";
      subscription.status = "active";
      subscription.paymentVerificationId = paymentResult.paymentVerificationId;
      await subscription.save();

      console.log(
        `Payment successful for subscription: ${subscriptionId}, verification: ${paymentResult.paymentVerificationId}`
      );

      // Kirim response
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
      return next(new ErrorHandler(error.message, 500));
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
