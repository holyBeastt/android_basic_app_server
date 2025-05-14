import { Router } from "express";
import User from "../models/user.js";
import jwt from "jsonwebtoken";
import authController from "../controllers/auth_controller.js";

const routes = new Router();

const generateToken = async (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1d" });
};

routes.get("register");

routes.post("/login", async (req, res) => {
  try {
    const { password, email } = req.body;

    if (!password || !email) {
      return res.status(400).json({ message: "All field are required" });
    }

    // Check if email already exist
    const account = await User.findOne({ email });
    if (!account) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isValidPw = await account.comparePassword(password);
    if (!isValidPw) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Create token
    const token = await generateToken(account._id);

    return res.status(201).json({
      token,
      user: {
        userName: account.userName,
        id: account._id,
        profileImage: account.profileImage,
        email: account.email,
      },
    });
  } catch (error) {
    console.log("Error in register route", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default routes;
