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

const googleLogin = async (req, res) => {
  const timestamp = new Date().toISOString();

  try {
    const { idToken, email, displayName, photoUrl } = req.body;
    console.log(`[${timestamp}] [GOOGLE LOGIN] Attempt: ${email}`);

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
      console.log(`[${timestamp}] [GOOGLE REGISTER] Creating new user for: ${googleEmail}`);

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
        console.error("Insert Error:", insertError);
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
    console.error(`[${timestamp}] [GOOGLE AUTH ERROR]:`, error);
    return res.status(500).json({ message: 'Lỗi xác thực Google phía Server' });
  }
}

export { authenticateToken, googleLogin };
