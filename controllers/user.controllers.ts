import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import UserModel from "../models/user.models";
import SubscriptionModel from "../models/subscription.models";
import ErrorHandler from "../utils/error.handler";
import { CatchAsyncError } from "../middleware/catchAsynError";
import jwt, { JwtPayload } from "jsonwebtoken";
import { sendToken } from "../utils/jwt";
import { redis } from "../utils/redis";
import { getAllUsersService, getUserById } from "../services/user.services";
import cloudinary from "cloudinary";

dotenv.config();

interface IRegistrationBody {
  name: string;
  email: string;
  password: string;
  passwordAgain: string;
  avatar?: string;
  subscriptionId: string;
}

export const registrationUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password, passwordAgain, subscriptionId } =
        req.body as IRegistrationBody;

      if (password !== passwordAgain) {
        return next(new ErrorHandler("Passwords do not match", 400));
      }

      // Check if user with this email already exists
      const existingUser = await UserModel.findOne({ email });
      if (existingUser) {
        return next(new ErrorHandler("Email already registered", 400));
      }

      // Verify subscription
      const subscription = await SubscriptionModel.findById(subscriptionId);
      if (!subscription || subscription.paymentStatus !== "completed") {
        return next(new ErrorHandler("Valid subscription required", 400));
      }

      const user = await UserModel.create({
        name,
        email,
        password,
        subscription: {
          subscriptionId: subscription._id,
        },
      });

      subscription.userId = user.id;
      await subscription.save();

      await redis.set(user.id, JSON.stringify(user), "EX", 604800);

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

export const loginUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return next(new ErrorHandler("Please enter email and password", 400));
      }

      const user = await UserModel.findOne({ email }).select("+password");

      if (!user) {
        return next(new ErrorHandler("Invalid email or password", 400));
      }

      const isPasswordMatch = await user.comparePassword(password);
      if (!isPasswordMatch) {
        return next(new ErrorHandler("Invalid email or password", 400));
      }
      sendToken(user, 200, res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

export const logoutUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Clear JWT tokens from cookies/headers
      res.cookie("access_token", "", {
        maxAge: 1,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });

      res.cookie("refresh_token", "", {
        maxAge: 1,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });

      // Clear user session from redis if userId is available
      const userId = req.query.userId as string;
      if (userId) {
        await redis.del(userId);
      }

      res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

export const updateAccessToken = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refresh_token = req.headers["refresh-token"] as string;
      const decoded = jwt.verify(
        refresh_token,
        process.env.REFRESH_TOKEN as string
      ) as JwtPayload;

      if (!decoded) {
        return next(new ErrorHandler("Invalid refresh token", 400));
      }

      const session = await redis.get(decoded.id as string);
      if (!session) {
        return next(
          new ErrorHandler("Session expired, please login again", 400)
        );
      }

      const user = JSON.parse(session);
      await redis.set(user.id, JSON.stringify(user), "EX", 604800); // 7days

      next();
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

export const getUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId;
      if (!userId) {
        return next(new ErrorHandler("User ID is required", 400));
      }
      getUserById(userId, res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

interface IUpdateUserInfo {
  name?: string;
  email?: string;
  userId: string;
}

export const updateUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, userId } = req.body as IUpdateUserInfo;

      if (!userId) {
        return next(new ErrorHandler("User ID is required", 400));
      }

      const user = await UserModel.findById(userId);
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      if (name) {
        user.name = name;
      }

      await user.save();
      await redis.set(userId, JSON.stringify(user));

      res.status(201).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

interface IUpdatePassword {
  oldPassword: string;
  newPassword: string;
  userId: string;
}

export const updatePassword = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { oldPassword, newPassword, userId } = req.body as IUpdatePassword;

      if (!oldPassword || !newPassword) {
        return next(new ErrorHandler("Please enter old and new password", 400));
      }

      if (!userId) {
        return next(new ErrorHandler("User ID is required", 400));
      }

      const user = await UserModel.findById(userId).select("+password");
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      const isPasswordMatch = await user.comparePassword(oldPassword);
      if (!isPasswordMatch) {
        return next(new ErrorHandler("Invalid old password", 400));
      }

      user.password = newPassword;
      await user.save();
      await redis.set(userId, JSON.stringify(user));

      res.status(201).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

interface IUpdateProfilePicture {
  avatar: string;
  userId: string;
}

export const updateProfilePicture = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { avatar, userId } = req.body as IUpdateProfilePicture;

      if (!userId) {
        return next(new ErrorHandler("User ID is required", 400));
      }

      const user = await UserModel.findById(userId);
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      if (avatar) {
        if (user.avatar?.public_id) {
          await cloudinary.v2.uploader.destroy(user.avatar.public_id);
        }

        const myCloud = await cloudinary.v2.uploader.upload(avatar, {
          folder: "avatars",
          width: 150,
        });

        user.avatar = {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        };
      }

      await user.save();
      await redis.set(userId, JSON.stringify(user));

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

export const getAllUsers = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      getAllUsersService(res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);