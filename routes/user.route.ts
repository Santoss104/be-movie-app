import express from "express";
import {
  registrationUser,
  loginUser,
  logoutUser,
  getUserInfo,
  updateUserInfo,
  updatePassword,
  updateProfilePicture,
  getAllUsers,
} from "../controllers/user.controllers";
import { checkUserRole } from "../middleware/auth.middleware";

const userRouter = express.Router();

// Public routes
userRouter.post("/register", registrationUser);
userRouter.post("/login", loginUser);
userRouter.get("/me/:userId", getUserInfo);
userRouter.get("/logout", logoutUser); 
userRouter.put("/update-user-info", updateUserInfo); 
userRouter.put("/update-user-password", updatePassword);
userRouter.put("/update-profile-avatar", updateProfilePicture); 

userRouter.get("/get-users", checkUserRole(["admin"]), getAllUsers);

export default userRouter;