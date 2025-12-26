import supabase from "../config/supabase.js";
import bcrypt from "bcrypt";
import { OAuth2Client } from 'google-auth-library';
import jwt from "jsonwebtoken";
import { encryptData, decryptData } from "../utils/crypto.js";
import { sendAccountLockedEmail } from "../utils/emailService.js";
import logger from "../utils/logger.js";
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Hàm helper để tạo bộ đôi token
const generateTokens = async (user) => {
  const accessToken = jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET,
    { expiresIn: '20s' }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  const salt = 10;
  const hashedRefreshToken = await bcrypt.hash(refreshToken, salt);

  logger.debug(`Đang lưu Hash vào DB cho User ID: ${user.id}`);

  const { data, error } = await supabase
    .from('users')
    .update({
      refresh_token_hash: hashedRefreshToken,
      last_login: new Date(),
      login_attempts: 0, // Reset số lần đăng nhập sai khi đăng nhập thành công
      locked_until: null  // Mở khóa tài khoản
    })
    .eq('id', user.id)
    .select();

  if (error) {
    logger.error("Không lưu được Refresh Token vào DB!", error);
  } else {
    logger.debug("Đã lưu Refresh Token Hash thành công!");
  }

  return { accessToken, refreshToken };
};

// ========== HÀM MỚI:  KIỂM TRA VÀ CẬP NHẬT SỐ LẦN ĐĂNG NHẬP SAI ==========
const handleFailedLogin = async (userId, currentAttempts, lockedUntil, userEmail, encryptedUsername) => {
  const now = new Date();

  // Kiểm tra đang bị khóa
  if (lockedUntil && new Date(lockedUntil) > now) {
    const remainingTime = Math.ceil((new Date(lockedUntil) - now) / 1000);
    return {
      isLocked: true,
      message: `Tài khoản đã bị khóa.  Vui lòng thử lại sau ${remainingTime} giây. `,
      remainingTime
    };
  }

  const newAttempts = (currentAttempts || 0) + 1;

  // Nếu sai 3 lần → Khóa + Gửi email
  if (newAttempts >= 3) {
    const lockTime = new Date(now.getTime() + 60 * 1000); // Khóa 60 giây

    // Cập nhật DB
    await supabase
      .from('users')
      .update({
        login_attempts: newAttempts,
        locked_until: lockTime.toISOString()
      })
      .eq('id', userId);

    // GỬI EMAIL (không chặn flow chính)
    if (userEmail) {
      const decryptedUsername = encryptedUsername ? decryptData(encryptedUsername) : 'User';
      sendAccountLockedEmail(userEmail, decryptedUsername).catch(err => {
        logger.error('Email không gửi được:', err.message);
      });
    }

    return {
      isLocked: true,
      message: `Tài khoản bị khóa 1 phút do nhập sai mật khẩu 3 lần. Email cảnh báo đã được gửi.`,
      attemptsLeft: 0
    };
  }

  // Chưa đủ 3 lần
  await supabase
    .from('users')
    .update({
      login_attempts: newAttempts,
      locked_until: null
    })
    .eq('id', userId);

  return {
    isLocked: false,
    message: `Sai mật khẩu. Bạn còn ${3 - newAttempts} lần thử. `,
    attemptsLeft: 3 - newAttempts
  };
};

const performLazyMigration = async (user) => {
  logger.debug("performLazyMigration: start");
  const fieldsToMigrate = ['username', 'bio']; // Danh sách các trường cần kiểm tra mã hóa
  let needsUpdate = false;
  const updateData = {};

  for (const field of fieldsToMigrate) {
    // Kiểm tra nếu trường có dữ liệu và CHƯA chứa ký tự phân tách của crypto (ví dụ ':')
    if (user[field] && !String(user[field]).includes(':')) {
      logger.debug(`[MIGRATION] Encrypting legacy data for field [${field}] - User ID: ${user.id}`);
      updateData[field] = encryptData(user[field]);
      user[field] = updateData[field]; // Cập nhật trực tiếp vào đối tượng user hiện tại
      needsUpdate = true;
    }
  }

  if (needsUpdate) {
    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id);

    if (error) {
      logger.error(`[MIGRATION ERROR] Failed to update user:`, error);
    }
  }

  logger.debug("performLazyMigration: end");

  return user;
};

// ========== 1. ĐĂNG NHẬP THƯỜNG (Username/Password) ==========
const login = async (req, res) => {
  const { username, password } = req.body;
  const timestamp = new Date().toISOString();

  try {
    logger.debug(`[LOGIN ATTEMPT] Account: [HIDDEN]`);

    // Lấy thông tin user
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("username_acc", username)
      .single();

    if (!user || error) {
      return res.status(401).json({ error: "Tên đăng nhập không tồn tại." });
    }

    // ========== KIỂM TRA TÀI KHOẢN CÓ BỊ KHÓA KHÔNG ==========
    const now = new Date();
    if (user.locked_until && new Date(user.locked_until) > now) {
      const remainingTime = Math.ceil((new Date(user.locked_until) - now) / 1000);
      return res.status(423).json({
        error: `Tài khoản bị khóa. Vui lòng thử lại sau ${remainingTime} giây.`,
        remainingTime,
        isLocked: true
      });
    }

    // ========== KIỂM TRA MẬT KHẨU ==========
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      // Xử lý đăng nhập sai
      const failResult = await handleFailedLogin(
        user.id,
        user.login_attempts,
        user.locked_until,
        user.email,
        user.username
      );

      return res.status(401).json({
        error: failResult.message,
        attemptsLeft: failResult.attemptsLeft,
        isLocked: failResult.isLocked,
        remainingTime: failResult.remainingTime
      });
    }

    // Thực hiện migration trước khi tạo Token và trả về dữ liệu
    await performLazyMigration(user);

    // ========== ĐĂNG NHẬP THÀNH CÔNG ==========
    const { accessToken, refreshToken } = await generateTokens(user);
    const decryptedDisplayName = user.username ? decryptData(user.username) : "User";

    const loginMessage = user.is_instructor
      ? "Đăng nhập thành công với tư cách giảng viên"
      : "Đăng nhập thành công với tư cách học viên";

    return res.status(200).json({
      message: loginMessage,
      user: {
        id: user.id,
        username: decryptedDisplayName,
        is_instructor: user.is_instructor,
        avatar: user.avatar_url
      },
      accessToken,
      refreshToken,
    });

  } catch (err) {
    logger.error("Login error:", err);
    return res.status(500).json({ error: "Lỗi hệ thống khi đăng nhập" });
  }
};

// ========== 2. ĐĂNG KÝ THƯỜNG ==========
const register = async (req, res) => {
  const { username_acc, password, confirmPassword, username, sex } = req.body;
  const timestamp = new Date().toISOString();

  if (!username_acc || !password || !username || !sex) {
    return res.status(400).json({ error: "Vui lòng điền đầy đủ thông tin." });
  }

  if (!['male', 'female', 'other'].includes(sex)) {
    return res.status(400).json({ error: "Giới tính không hợp lệ." });
  }

  try {
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("username_acc", username_acc)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ error: "Tên đăng nhập đã tồn tại." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const encryptedDisplayName = encryptData(username);

    const { data, error } = await supabase
      .from("users")
      .insert([{
        username_acc: username_acc,
        password: hashedPassword,
        username: encryptedDisplayName,
        sex: sex,
        is_instructor: false,
        login_attempts: 0,  // Khởi tạo
        locked_until: null  // Khởi tạo
      }])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      message: "Đăng ký thành công",
      userId: data.id
    });

  } catch (err) {
    logger.error("Register error:", err);
    return res.status(500).json({ error: "Lỗi khi tạo tài khoản." });
  }
};

// ========== 3. ĐĂNG NHẬP GOOGLE ==========
const googleLogin = async (req, res) => {
  const timestamp = new Date().toISOString();

  try {
    const { idToken, email, displayName, photoUrl } = req.body;

    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const googleEmail = payload.email;

    if (email !== googleEmail) {
      return res.status(400).json({ message: 'Email không khớp với Google Token' });
    }

    let { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', googleEmail)
      .maybeSingle();

    if (user) {
      await performLazyMigration(user);
    }

    if (!user) {
      logger.debug(`[REGISTER GOOGLE] New user registered`);
      const generatedUsername = googleEmail.split('@')[0];
      const encryptedName = encryptData(displayName || generatedUsername);

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{
          username_acc: googleEmail,
          username: encryptedName,
          email: googleEmail,
          avatar_url: photoUrl,
          sex: 'male',
          is_instructor: false,
          login_attempts: 0,
          locked_until: null
        }])
        .select()
        .single();

      if (insertError) throw insertError;
      user = newUser;
    }

    const { accessToken, refreshToken } = await generateTokens(user);

    return res.status(200).json({
      message: 'Đăng nhập Google thành công',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username ? decryptData(user.username) : displayName,
        is_instructor: user.is_instructor,
        avatar: user.avatar_url
      }
    });

  } catch (error) {
    logger.error("[GOOGLE AUTH ERROR]:", error);
    return res.status(500).json({ message: 'Lỗi xác thực Google phía Server' });
  }
};

// ========== 4. LẤY ACCESS TOKEN MỚI (REFRESH) ==========

// Cách viết khuyến nghị (Sử dụng Promisify hoặc await trực tiếp)
const requestRefreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json("Bạn chưa gửi Refresh Token");

    // Thay vì dùng callback, ta có thể dùng try-catch cho verify
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(403).json("Refresh Token hết hạn hoặc không hợp lệ");
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, refresh_token_hash')
      .eq('id', decoded.id)
      .single();

    if (error || !user || !user.refresh_token_hash) {
      return res.status(403).json("Token không tồn tại");
    }

    const isMatch = await bcrypt.compare(refreshToken, user.refresh_token_hash);
    if (!isMatch) {
      await supabase.from('users').update({ refresh_token_hash: null }).eq('id', user.id);
      return res.status(403).json("Token không hợp lệ! Vui lòng đăng nhập lại.");
    }

    const newAccessToken = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    logger.debug("New access token generated");

    return res.status(200).json({ accessToken: newAccessToken });

  } catch (err) {
    logger.error("Refresh Token Error:", err);
    return res.status(500).json({ error: "Lỗi hệ thống" });
  }
};
// const requestRefreshToken = async (req, res) => {
//   try {
//     const { refreshToken } = req.body;
//     if (!refreshToken) return res.status(401).json("Bạn chưa gửi Refresh Token");

//     jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
//       if (err) return res.status(403).json("Refresh Token hết hạn hoặc không hợp lệ");

//       const { data: user } = await supabase
//         .from('users')
//         .select('id, refresh_token_hash')
//         .eq('id', decoded.id)
//         .single();

//       if (!user || !user.refresh_token_hash) {
//         return res.status(403).json("Token không tồn tại");
//       }

//       const isMatch = await bcrypt.compare(refreshToken, user.refresh_token_hash);
//       if (!isMatch) {
//         await supabase.from('users').update({ refresh_token_hash: null }).eq('id', user.id);
//         return res.status(403).json("Token không hợp lệ! Vui lòng đăng nhập lại.");
//       }

//       const newAccessToken = jwt.sign(
//         { id: user.id },
//         process.env.JWT_SECRET,
//         { expiresIn: '1h' }
//       );

//       return res.status(200).json({ accessToken: newAccessToken });
//     });
//   } catch (err) {
//     return res.status(500).json(err);
//   }
// };

export default {
  login,
  register,
  googleLogin,
  requestRefreshToken
};