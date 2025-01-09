import { Response } from "express";
import { redis } from "../utils/redis";
import UserModel from "../models/user.models";

// get user by id
export const getUserById = async (id: string, res: Response) => {
    const userJson = await redis.get(id);

    if (userJson) {
        const user = JSON.parse(userJson);
        res.status(201).json({
        success: true,
        user,
        });
    }
};

// Get All users
export const getAllUsersService = async (res: Response) => {
    const users = await UserModel.find().sort({ createdAt: -1 });

    res.status(201).json({
        success: true,
        users,
    });
};