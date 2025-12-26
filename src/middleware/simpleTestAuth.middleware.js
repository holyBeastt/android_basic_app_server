// Simple test middleware that bypasses complex authentication
import jwt from "jsonwebtoken";
import supabase from "../config/supabase.js";
import logger from "../utils/logger.js";

export const simpleTestAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Token không được cung cấp" });
    }

    const token = authHeader.substring(7);

    // For testing, allow simple bypass
    if (token === 'test-token') {
      // Get instructor ID from header for testing multiple instructors
      const testInstructorId = req.headers['x-test-instructor-id'] || '1';

      // Mock user for testing
      req.user = {
        id: parseInt(testInstructorId),
        username: `test-instructor-${testInstructorId}`,
        is_instructor: true,
        is_active: true
      };
      return next();
    }

    // Handle invalid test tokens
    if (token.startsWith('invalid') || token === 'invalid') {
      return res.status(401).json({ error: "Token không hợp lệ" });
    }

    // Try to verify JWT token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user details from database
      const { data: userProfile, error: profileError } = await supabase
        .from("users")
        .select("id, username, is_instructor, is_active")
        .eq("id", decoded.id)
        .single();

      if (profileError || !userProfile) {
        return res.status(404).json({ error: "Không tìm thấy thông tin người dùng" });
      }

      if (!userProfile.is_active) {
        return res.status(403).json({ error: "Tài khoản đã bị vô hiệu hóa" });
      }

      // For testing, bypass instructor check or make user instructor
      req.user = {
        id: userProfile.id,
        username: userProfile.username,
        is_instructor: true, // Force instructor for testing
        is_active: userProfile.is_active
      };

      next();
    } catch (jwtError) {
      logger.error("JWT verification error:", jwtError);
      return res.status(401).json({ error: "Token không hợp lệ" });
    }

  } catch (error) {
    logger.error("Simple auth middleware error:", error);
    return res.status(500).json({ error: "Lỗi xác thực" });
  }
};
