// middleware/instructorAuth.middleware.js
import supabase from "../config/supabase.js";

const instructorAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Token không được cung cấp" });
    }

    const token = authHeader.substring(7);
    
    // Verify JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: "Token không hợp lệ" });
    }

    // Get user details to check if they are an instructor
    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("id, is_instructor, is_active")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile) {
      return res.status(404).json({ error: "Không tìm thấy thông tin người dùng" });
    }

    if (!userProfile.is_active) {
      return res.status(403).json({ error: "Tài khoản đã bị vô hiệu hóa" });
    }

    if (!userProfile.is_instructor) {
      return res.status(403).json({ error: "Bạn không có quyền giảng viên" });
    }

    // Add user info to request
    req.user = {
      id: user.id,
      email: user.email,
      ...userProfile
    };

    next();
  } catch (error) {
    console.error("InstructorAuth middleware error:", error);
    return res.status(500).json({ error: "Lỗi xác thực" });
  }
};

// Optional auth - doesn't fail if no token, but validates if provided
const optionalInstructorAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without user info
    }

    const token = authHeader.substring(7);
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (!error && user) {
      const { data: userProfile } = await supabase
        .from("users")
        .select("id, is_instructor, is_active")
        .eq("id", user.id)
        .single();

      if (userProfile && userProfile.is_active && userProfile.is_instructor) {
        req.user = {
          id: user.id,
          email: user.email,
          ...userProfile
        };
      }
    }

    next();
  } catch (error) {
    console.error("OptionalInstructorAuth middleware error:", error);
    next(); // Continue without user info
  }
};

export { instructorAuth, optionalInstructorAuth };
