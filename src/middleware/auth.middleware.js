import jwt from "jsonwebtoken";
import User from "../models/user.js";
import supabase from "../config/supabase.js";
import logger from "../utils/logger.js";

const authenticateToken = async (req, res, next) => {
  try {
    // 1. Lấy token từ header Authorization: Bearer <token>
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      logger.debug("Token missing");
      return res.status(401).json({ message: "Không tìm thấy mã xác thực." });
    }

    // 2. Xác minh JWT
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        if (err.name === "TokenExpiredError") {
          logger.debug("Token expired");
          return res.status(401).json({
            code: "ACCESS_TOKEN_EXPIRED", // Mã để Flutter biết cần refresh
            message: "Token đã hết hạn"
          });
        }
        return res.status(401).json({ message: "Token không hợp lệ" });
      }

      // 3. Truy vấn User từ Supabase dựa trên 'id' trong token
      const { data: user, error } = await supabase
        .from('users')
        .select('id, username, is_instructor')
        .eq('id', decoded.id)
        .single();

      if (error || !user) {
        return res.status(404).json({ message: "Người dùng không tồn tại." });
      }

      // 5. Gán thông tin user vào request để dùng ở các controller sau
      req.user = user;
      next();
    });

  } catch (error) {
    logger.error("Auth Middleware Error:", error);
    return res.status(500).json({ message: "Lỗi hệ thống xác thực." });
  }
};

const googleLogin = async (req, res) => {
  const timestamp = new Date().toISOString();

  try {
    const { idToken, email, displayName, photoUrl } = req.body;
    logger.debug(`[GOOGLE LOGIN] Attempt`);

    // 1. Xác thực idToken với Google
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleEmail = payload.email;

    // Bảo mật: Validate email
    if (email !== googleEmail) {
      return res.status(400).json({ message: 'Token không hợp lệ' });
    }

    // 2. Kiểm tra user trong Supabase
    // Lưu ý: Cần đảm bảo bảng 'users' có cột 'email' hoặc dùng 'username_acc' để lưu email
    let { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', googleEmail) // Nên thêm cột email vào DB
      .maybeSingle(); // Dùng maybeSingle an toàn hơn single (tránh lỗi nếu không tìm thấy)

    // 3. Nếu chưa có user -> Tạo mới
    if (!user) {
      logger.debug(`[GOOGLE REGISTER] Creating new user`);

      // Tạo username từ phần đầu email nếu chưa có
      const generatedUsername = googleEmail.split('@')[0];

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            // Mapping dữ liệu cho khớp với DB của bạn
            username_acc: googleEmail, // Dùng email làm tên đăng nhập luôn cho user Google
            username: displayName || generatedUsername,
            email: googleEmail,        // Cần thêm cột này vào DB
            avatar_url: photoUrl,      // Cần thêm cột này vào DB
            // password: null,         // User Google không có pass
            sex: 'male',              // Giá trị mặc định vì Google không trả về sex
            is_instructor: false       // Mặc định là học viên
          }
        ])
        .select()
        .single();

      if (insertError) {
        logger.error("Google Insert Error:", insertError);
        throw insertError;
      }
      user = newUser;
    }

    // 4. Tạo JWT 
    // SỬA LỖI: Đổi 'userId' thành 'id' để khớp với hàm login thường
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '30d' } // Token Google cho sống lâu hơn chút cũng được
    );

    // 5. Trả về client
    return res.status(200).json({
      message: 'Đăng nhập Google thành công',
      token: token,
      user: {
        id: user.id,
        username: user.username,
        is_instructor: user.is_instructor,
        avatar: user.avatar_url
      }
    });

  } catch (error) {
    logger.error("[GOOGLE AUTH ERROR]:", error);
    return res.status(500).json({ message: 'Lỗi xác thực Google phía Server' });
  }
}

/**
 * Middleware kiểm tra quyền giảng viên (sở hữu khóa học của bài học)
 * Yêu cầu: authenticateToken đã chạy trước, req.params.lessonId tồn tại
 */
const checkInstructorAccess = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { lessonId } = req.params;

    // Lấy thông tin bài học và kiểm tra quyền sở hữu
    const { data: lessonData, error: lessonError } = await supabase
      .from('lessons')
      .select(`
        id,
        content_url,
        course_id,
        duration,
        courses:course_id (
          user_id
        )
      `)
      .eq('id', lessonId)
      .single();

    if (lessonError || !lessonData) {
      return res.status(404).json({ error: "Bài học không tồn tại" });
    }

    const instructorId = lessonData.courses?.user_id;

    // Kiểm tra user có phải là giảng viên sở hữu không
    if (userId !== instructorId) {
      return res.status(403).json({ error: "Bạn không phải giảng viên của khóa học này" });
    }

    // Gán lessonData vào request để controller sử dụng
    req.lessonData = lessonData;
    next();
  } catch (error) {
    logger.error("checkInstructorAccess Error:", error);
    return res.status(500).json({ error: "Lỗi kiểm tra quyền giảng viên" });
  }
};

/**
 * Middleware kiểm tra quyền học viên đã thanh toán
 * Yêu cầu: authenticateToken đã chạy trước, req.params.lessonId tồn tại
 */
const checkPaidStudentAccess = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { lessonId } = req.params;

    // 🔍 DEBUG LOG: Thông tin request
    logger.log("========== checkPaidStudentAccess DEBUG ==========");
    logger.log("User ID đang request:", userId);
    logger.log("Lesson ID yêu cầu:", lessonId);

    // Lấy thông tin bài học
    const { data: lessonData, error: lessonError } = await supabase
      .from('lessons')
      .select(`
        id,
        content_url,
        course_id,
        duration,
        courses:course_id (
          user_id
        )
      `)
      .eq('id', lessonId)
      .single();

    if (lessonError || !lessonData) {
      logger.log("❌ Bài học không tồn tại. Lesson Error:", lessonError?.message);
      return res.status(404).json({ error: "Bài học không tồn tại" });
    }

    const courseId = lessonData.course_id;

    // 🔍 DEBUG LOG: Thông tin bài học
    logger.log("Course ID của bài học:", courseId);

    // Kiểm tra đã thanh toán chưa
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, status, user_id, course_id')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .eq('status', 'PAID')
      .maybeSingle();

    // 🔍 DEBUG LOG: Kết quả query payment
    logger.log("Payment Query Result:", payment);
    logger.log("Payment Error:", paymentError?.message || "Không có lỗi");

    if (paymentError) {
      logger.error("checkPaidStudentAccess - Payment query error:", paymentError.message);
    }

    if (!payment) {
      // Query lại tất cả payments của user cho course này để debug
      const { data: allPayments } = await supabase
        .from('payments')
        .select('id, status, user_id, course_id, created_at')
        .eq('user_id', userId)
        .eq('course_id', courseId);

      logger.log("📋 Tất cả payments của user cho course này:", allPayments);
      logger.log("❌ Không tìm thấy payment với status='PAID'");
      logger.log("🚫 TỪ CHỐI TRUY CẬP");
      logger.log("===================================================");
      return res.status(403).json({ error: "Bạn chưa thanh toán khóa học này" });
    }

    logger.log("✅ User ĐÃ THANH TOÁN - Cho phép truy cập");
    logger.log("===================================================");

    // Gán lessonData vào request để controller sử dụng
    req.lessonData = lessonData;
    next();
  } catch (error) {
    logger.error("checkPaidStudentAccess Error:", error);
    return res.status(500).json({ error: "Lỗi kiểm tra quyền học viên" });
  }
};

/**
 * Middleware kiểm tra quyền truy cập video (Giảng viên HOẶC Học viên đã thanh toán)
 * Đây là middleware kết hợp, cho phép cả 2 loại user truy cập
 */
const checkVideoAccess = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { lessonId } = req.params;

    // 🔍 DEBUG LOG: Thông tin request
    logger.log("========== checkVideoAccess DEBUG ==========");
    logger.log("User ID đang request:", userId);
    logger.log("Lesson ID yêu cầu:", lessonId);

    // Lấy thông tin bài học
    const { data: lessonData, error: lessonError } = await supabase
      .from('lessons')
      .select(`
        id,
        content_url,
        course_id,
        duration,
        courses:course_id (
          user_id
        )
      `)
      .eq('id', lessonId)
      .single();

    if (lessonError || !lessonData) {
      logger.log("❌ Bài học không tồn tại. Lesson Error:", lessonError?.message);
      return res.status(404).json({ error: "Bài học không tồn tại" });
    }

    const courseId = lessonData.course_id;
    const instructorId = lessonData.courses?.user_id;

    // 🔍 DEBUG LOG: Thông tin bài học
    logger.log("Course ID của bài học:", courseId);
    logger.log("Instructor ID (chủ khóa học):", instructorId);

    let hasAccess = false;

    // Kiểm tra 1: User là giảng viên?
    if (userId === instructorId) {
      logger.log("✅ User là GIẢNG VIÊN sở hữu khóa học");
      hasAccess = true;
    } else {
      logger.log("👤 User KHÔNG phải giảng viên, kiểm tra thanh toán...");

      // Kiểm tra 2: User đã thanh toán?
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select('id, status, user_id, course_id')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .eq('status', 'PAID')
        .maybeSingle();

      // 🔍 DEBUG LOG: Kết quả query payment
      logger.log("Payment Query Result:", payment);
      logger.log("Payment Error:", paymentError?.message || "Không có lỗi");

      if (payment) {
        logger.log("✅ User ĐÃ THANH TOÁN khóa học");
        hasAccess = true;
      } else {
        // Query lại tất cả payments của user cho course này để debug
        const { data: allPayments } = await supabase
          .from('payments')
          .select('id, status, user_id, course_id, created_at')
          .eq('user_id', userId)
          .eq('course_id', courseId);

        logger.log("📋 Tất cả payments của user cho course này:", allPayments);
        logger.log("❌ Không tìm thấy payment với status='PAID'");
      }
    }

    if (!hasAccess) {
      logger.log("🚫 TỪ CHỐI TRUY CẬP - User không có quyền xem video");
      logger.log("==============================================");
      return res.status(403).json({ error: "Bạn không có quyền truy cập bài học này" });
    }

    logger.log("✅ CHO PHÉP TRUY CẬP - Tạo signed URL...");
    logger.log("==============================================");

    // Gán lessonData vào request để controller sử dụng
    req.lessonData = lessonData;
    next();
  } catch (error) {
    logger.error("checkVideoAccess Error:", error);
    return res.status(500).json({ error: "Lỗi kiểm tra quyền truy cập video" });
  }
};

const authorizeSelf = (req, res, next) => {
  const paramUserId = req.params.userId;
  const tokenUserId = req.user.id;

  if (paramUserId !== tokenUserId) {
    return res.status(403).json({
      message: "Bạn không có quyền truy cập tài nguyên này"
    });
  }

  next();
};

export default {
  authenticateToken,
  googleLogin,
  checkInstructorAccess,
  checkPaidStudentAccess,
  checkVideoAccess,
  authorizeSelf
};
