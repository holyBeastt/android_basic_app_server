import supabase from "../config/supabase.js";
import bcrypt from "bcrypt";
import { OAuth2Client } from 'google-auth-library';
import jwt from "jsonwebtoken";
// [QUAN TRỌNG] Import file crypto bạn đã tạo
import { encryptData, decryptData } from "../utils/crypto.js";

// Config Google Client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Hàm helper để tạo bộ đôi token (Dùng chung cho cả Login thường và Google)
// Hàm helper debug
const generateTokens = async (user) => {
  const accessToken = jwt.sign(
    { id: user.id, role: user.is_instructor ? 'instructor' : 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' } // Sửa thành 30d nếu muốn lâu hơn
  );

  // Hash refresh token
  const salt = 10;
  const hashedRefreshToken = await bcrypt.hash(refreshToken, salt);

  console.log(`[DEBUG] Đang lưu Hash vào DB cho User ID: ${user.id}`);
  console.log(`[DEBUG] Hash length: ${hashedRefreshToken.length}`);

  // Lưu vào DB và BẮT LỖI
  const { data, error } = await supabase
    .from('users')
    .update({
      refresh_token_hash: hashedRefreshToken,
      last_login: new Date()
    })
    .eq('id', user.id)
    .select(); // Thêm select() để xem nó có trả về dòng nào không

  if (error) {
    console.error("❌ LỖI NGHIÊM TRỌNG: Không lưu được Refresh Token vào DB!");
    console.error("Chi tiết lỗi:", error);
    // Gợi ý lỗi thường gặp
    if (error.code === '42703') console.error("-> Gợi ý: Có thể bạn CHƯA TẠO CỘT 'refresh_token_hash' trong Supabase?");
    if (error.code === '42501') console.error("-> Gợi ý: Lỗi quyền hạn (RLS). Hãy kiểm tra xem bạn có đang dùng SERVICE_ROLE_KEY không?");
  } else {
    console.log("✅ Đã lưu Refresh Token Hash thành công!");
  }

  return { accessToken, refreshToken };
};


// 1. ĐĂNG NHẬP THƯỜNG (Username/Password)
const login = async (req, res) => {
  const { username, password } = req.body; // username ở đây là username_acc (tài khoản đăng nhập)
  const timestamp = new Date().toISOString();

  try {
    console.log(`[${timestamp}] [LOGIN ATTEMPT] Account: ${username}`);

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("username_acc", username)
      .single();

    if (!user || error) {
      return res.status(401).json({ error: "Tên đăng nhập không tồn tại." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Sai mật khẩu." });
    }

    // [NEW] Tạo Access + Refresh Token (Thay vì chỉ 1 token như cũ)
    const { accessToken, refreshToken } = await generateTokens(user);

    // [NEW] Giải mã tên hiển thị để trả về Client
    const decryptedDisplayName = user.username ? decryptData(user.username) : "User";

    const loginMessage = user.is_instructor
      ? "Đăng nhập thành công với tư cách giảng viên"
      : "Đăng nhập thành công với tư cách học viên";

    return res.status(200).json({
      message: loginMessage,
      user: {
        id: user.id,
        username: decryptedDisplayName, // Trả về tên thật (đã giải mã)
        is_instructor: user.is_instructor,
        avatar: user.avatar_url
      },
      accessToken,   // Client lưu RAM/Header
      refreshToken,  // Client lưu Cookie/LocalStorage
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi hệ thống khi đăng nhập" });
  }
};

// 2. ĐĂNG KÝ THƯỜNG
const register = async (req, res) => {
  const { username_acc, password, confirmPassword, username, sex } = req.body;
  const timestamp = new Date().toISOString();

  // Validate cơ bản...
  if (!username_acc || !password || !username || !sex) {
    return res.status(400).json({ error: "Vui lòng điền đầy đủ thông tin." });
  }

  // Validate giới tính...
  if (!['male', 'female', 'other'].includes(sex)) {
    return res.status(400).json({ error: "Giới tính không hợp lệ." });
  }

  try {
    // Check trùng username_acc
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("username_acc", username_acc)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ error: "Tên đăng nhập đã tồn tại." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // [NEW] Mã hóa tên hiển thị (username) trước khi lưu
    const encryptedDisplayName = encryptData(username);

    // Insert DB
    const { data, error } = await supabase
      .from("users")
      .insert([{
        username_acc: username_acc,
        password: hashedPassword,
        username: encryptedDisplayName, // Lưu bản mã hóa
        sex: sex,
        is_instructor: false // Mặc định
      }])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      message: "Đăng ký thành công",
      // Không cần trả về quá nhiều info, client sẽ tự redirect sang trang login
      userId: data.id
    });

  } catch (err) {
    console.error(`[${timestamp}] Register Error:`, err);
    return res.status(500).json({ error: "Lỗi khi tạo tài khoản." });
  }
};

// 3. ĐĂNG NHẬP GOOGLE
const googleLogin = async (req, res) => {
  const timestamp = new Date().toISOString();

  try {
    const { idToken, email, displayName, photoUrl } = req.body;

    // Validate Google Token
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const googleEmail = payload.email;

    if (email !== googleEmail) {
      return res.status(400).json({ message: 'Email không khớp với Google Token' });
    }

    // Tìm user
    let { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', googleEmail)
      .maybeSingle();

    // A. NẾU USER ĐÃ TỒN TẠI -> CHECK MIGRATION (QUAN TRỌNG)
    if (user) {
      // Nếu tên chưa được mã hóa (không chứa dấu ':') -> Mã hóa ngay
      if (user.username && !user.username.includes(':')) {
        console.log(`[MIGRATION] Mã hóa dữ liệu cũ cho user: ${googleEmail}`);
        const encryptedName = encryptData(user.username);

        // Update ngầm vào DB
        await supabase
          .from('users')
          .update({ username: encryptedName })
          .eq('id', user.id);

        // Update biến local để trả về đúng format
        user.username = encryptedName;
      }
    }

    // B. NẾU CHƯA CÓ USER -> TẠO MỚI
    if (!user) {
      console.log(`[REGISTER GOOGLE] New user: ${googleEmail}`);
      const generatedUsername = googleEmail.split('@')[0];

      // Mã hóa tên
      const encryptedName = encryptData(displayName || generatedUsername);

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{
          username_acc: googleEmail,
          username: encryptedName, // Lưu mã hóa
          email: googleEmail,
          avatar_url: photoUrl,
          sex: 'male',
          is_instructor: false
        }])
        .select()
        .single();

      if (insertError) throw insertError;
      user = newUser;
    }

    // C. TẠO TOKENS (Access + Refresh)
    const { accessToken, refreshToken } = await generateTokens(user);

    // D. TRẢ VỀ CLIENT
    return res.status(200).json({
      message: 'Đăng nhập Google thành công',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        // Giải mã tên
        username: user.username ? decryptData(user.username) : displayName,
        is_instructor: user.is_instructor,
        avatar: user.avatar_url
      }
    });

  } catch (error) {
    console.error(`[${timestamp}] [GOOGLE AUTH ERROR]:`, error);
    return res.status(500).json({ message: 'Lỗi xác thực Google phía Server' });
  }
};

// 4. LẤY ACCESS TOKEN MỚI (REFRESH)
const requestRefreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json("Bạn chưa gửi Refresh Token");

    // 1. Verify hạn sử dụng & chữ ký
    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err) return res.status(403).json("Refresh Token hết hạn hoặc không hợp lệ");

      // 2. Lấy hash từ DB
      const { data: user } = await supabase
        .from('users')
        .select('id, role, refresh_token_hash')
        .eq('id', decoded.id)
        .single();

      if (!user || !user.refresh_token_hash) {
        return res.status(403).json("Token không tồn tại");
      }

      // 3. So sánh Hash
      const isMatch = await bcrypt.compare(refreshToken, user.refresh_token_hash);
      if (!isMatch) {
        // Token giả hoặc đã bị dùng -> Xóa luôn để bắt đăng nhập lại
        await supabase.from('users').update({ refresh_token_hash: null }).eq('id', user.id);
        return res.status(403).json("Token không hợp lệ! Vui lòng đăng nhập lại.");
      }

      // 4. Cấp Access Token mới
      const newAccessToken = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      return res.status(200).json({ accessToken: newAccessToken });
    });
  } catch (err) {
    return res.status(500).json(err);
  }
};

export default {
  login,
  register,
  googleLogin,
  requestRefreshToken
};