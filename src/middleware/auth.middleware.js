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

      // 4. Kiểm tra xem tài khoản có đang bị khóa không (An toàn thêm)
      // if (user.locked_until && new Date(user.locked_until) > new Date()) {
      //   return res.status(423).json({ message: "Tài khoản đang bị khóa." });
      // }

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

export default { authenticateToken, googleLogin };
