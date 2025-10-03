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
    const timestamp = new Date().toISOString();
    
    console.log(`[${timestamp}] [LOGIN ATTEMPT] Email: ${email}`);

    if (!password || !email) {
      console.log(`[${timestamp}] [LOGIN FAILED] Email: ${email} - Reason: Missing required fields`);
      return res.status(400).json({ message: "All field are required" });
    }

    // Check if email already exist
    const account = await User.findOne({ email });
    if (!account) {
      console.log(`[${timestamp}] [LOGIN FAILED] Email: ${email} - Reason: Email not found`);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isValidPw = await account.comparePassword(password);
    if (!isValidPw) {
      console.log(`[${timestamp}] [LOGIN FAILED] Email: ${email} - Reason: Invalid password`);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Create token
    const token = await generateToken(account._id);

    console.log(`[${timestamp}] [LOGIN SUCCESS] Email: ${email} - User ID: ${account._id} - Username: ${account.userName}`);

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
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [LOGIN ERROR] Email: ${req.body.email} - Error: ${error.message}`);
    console.log("Error in register route", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default routes;
