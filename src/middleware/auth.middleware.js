import jwt from "jsonwebtoken";
import User from "../models/user.js";

const authenticateToken = async (req, res, next) => {
  try {
    const token = req.header("Authorization").replace("Bearer ", "");

    if (!token) {
      return res
        .status(401)
        .json({ message: "No authentication token, access denided" });
    }

    // verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // find the user
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res
        .status(401)
        .json({ message: "Token is invalid, access denied" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Error in authenticateToken middleware", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export default authenticateToken;
