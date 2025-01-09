import mongoose, { Document, Model, Schema } from "mongoose";

export interface ISubscription extends Document {
  planType: "monthly" | "yearly";
  price: number;
  status: "active" | "inactive";
  paymentStatus: "pending" | "completed" | "failed";
  paymentVerificationId?: string;
  startDate: Date;
  endDate: Date;
  userId?: string;
}

const subscriptionSchema: Schema<ISubscription> = new mongoose.Schema(
    {
      planType: {
        type: String,
        enum: ["monthly", "yearly"],
        required: true,
      },
      price: {
        type: Number,
        required: true,
      },
      status: {
        type: String,
        enum: ["active", "inactive"],
        default: "inactive",
      },
      paymentStatus: {
        type: String,
        enum: ["pending", "completed", "failed"],
        default: "pending",
      },
      paymentVerificationId: {
        type: String,
      },
      startDate: {
        type: Date,
        default: Date.now,
      },
      endDate: {
        type: Date,
        required: true,
      },
      userId: {
        type: String,
        ref: "User",
      },
    },
    { timestamps: true }
  );

const SubscriptionModel: Model<ISubscription> = mongoose.model(
  "Subscription",
  subscriptionSchema
);

export default SubscriptionModel;   