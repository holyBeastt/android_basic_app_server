import supabase from "../config/supabase.js";
import bcrypt from "bcrypt";
import { OAuth2Client } from 'google-auth-library';
import jwt from "jsonwebtoken";
import { encryptData, decryptData } from "../utils/crypto.js";
import { sendAccountLockedEmail, sendVerificationCodeEmail } from "../utils/emailService.js";

// Hàm tạo mã xác thực 6 số
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
import logger from "../utils/logger.js";
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Hàm helper để tạo bộ đôi token
const generateTokens = async (user) => {
  const accessToken = jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
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

// ========== HÀM XỬ LÝ ĐĂNG NHẬP SAI - GỬI MÃ XÁC THỰC ==========
const handleFailedLogin = async (userId, currentAttempts, userEmail, encryptedUsername, verificationCode, codeExpiresAt) => {
  const now = new Date();
  const newAttempts = (currentAttempts || 0) + 1;
  const MAX_ATTEMPTS = 5;

  // Kiểm tra đang bị khóa (có mã xác thực chưa hết hạn)
  if (verificationCode && codeExpiresAt && new Date(codeExpiresAt) > now) {
    return {
      needsVerification: true,
      message: 'Tài khoản đang bị khóa. Vui lòng nhập mã xác thực đã gửi về email.',
      attemptsLeft: 0
    };
  }

  // Nếu sai đủ 5 lần → Khóa + Tạo mã + Gửi email
  if (newAttempts >= MAX_ATTEMPTS) {
    const code = generateVerificationCode();  // Mã gốc: "847291"
    const codeExpiry = new Date(now.getTime() + 10 * 60 * 1000); // Mã có hiệu lực 10 phút
    
    // HASH mã OTP trước khi lưu vào DB (bảo mật như password)
    const hashedCode = await bcrypt.hash(code, 10);

    // Cập nhật DB với mã đã được HASH
    await supabase
      .from('users')
      .update({
        login_attempts: newAttempts,
        verification_code: hashedCode,  // Lưu hash, không lưu mã gốc
        code_expires_at: codeExpiry.toISOString()
      })
      .eq('id', userId);

    // GỬI EMAIL MÃ XÁC THỰC
    if (userEmail) {
      const decryptedUsername = encryptedUsername ? decryptData(encryptedUsername) : 'User';
      logger.debug(`📧 Đang gửi mã xác thực đến: ${userEmail}`);
      sendVerificationCodeEmail(userEmail, decryptedUsername, code)
        .then(result => {
          logger.debug(`📧 Kết quả gửi email:`, result);
        })
        .catch(err => {
          logger.error('❌ Không gửi được email:', err.message);
        });
    } else {
      logger.warn('⚠️ Không tìm thấy email, bỏ qua gửi mã');
    }

    return {
      needsVerification: true,
      message: `Tài khoản bị khóa do nhập sai mật khẩu ${MAX_ATTEMPTS} lần. Mã xác thực đã được gửi về email.`,
      attemptsLeft: 0
    };
  }

  // Chưa đủ 5 lần - cập nhật số lần thử
  await supabase
    .from('users')
    .update({
      login_attempts: newAttempts,
      verification_code: null,
      code_expires_at: null
    })
    .eq('id', userId);

  return {
    needsVerification: false,
    message: `Sai mật khẩu. Bạn còn ${MAX_ATTEMPTS - newAttempts} lần thử.`,
    attemptsLeft: MAX_ATTEMPTS - newAttempts
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

    // ========== KIỂM TRA TÀI KHOẢN ĐANG YÊU CẦU MÃ XÁC THỰC ==========
    const now = new Date();
    if (user.verification_code && user.code_expires_at && new Date(user.code_expires_at) > now) {
      return res.status(423).json({
        error: 'Tài khoản đang bị khóa. Vui lòng nhập mã xác thực đã gửi về email.',
        needsVerification: true,
        username: username
      });
    }

    // ========== KIỂM TRA MẬT KHẨU ==========
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      // Xử lý đăng nhập sai
      const failResult = await handleFailedLogin(
        user.id,
        user.login_attempts,
        user.email,
        user.username,
        user.verification_code,
        user.code_expires_at
      );

      // Nếu cần xác thực mã
      if (failResult.needsVerification) {
        return res.status(423).json({
          error: failResult.message,
          needsVerification: true,
          username: username
        });
      }

      return res.status(401).json({
        error: failResult.message,
        attemptsLeft: failResult.attemptsLeft,
        needsVerification: false
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
  const { username_acc, password, confirmPassword, username, email, sex } = req.body;
  const timestamp = new Date().toISOString();

  if (!username_acc || !password || !username || !email || !sex) {
    return res.status(400).json({ error: "Vui lòng điền đầy đủ thông tin." });
  }

  // Validation email format
  const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Email không hợp lệ." });
  }

  if (!['male', 'female', 'other'].includes(sex)) {
    return res.status(400).json({ error: "Giới tính không hợp lệ." });
  }

  try {
    // Kiểm tra username_acc đã tồn tại
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("username_acc", username_acc)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ error: "Tên đăng nhập đã tồn tại." });
    }

    // Kiểm tra email đã tồn tại
    const { data: existingEmail } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingEmail) {
      return res.status(400).json({ error: "Email đã được sử dụng." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const encryptedDisplayName = encryptData(username);

    const { data, error } = await supabase
      .from("users")
      .insert([{
        username_acc: username_acc,
        password: hashedPassword,
        username: encryptedDisplayName,
        email: email,
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

// ========== 5. XÁC THỰC MÃ MỞ KHÓA ==========
const verifyUnlockCode = async (req, res) => {
  const { username, code } = req.body;

  if (!username || !code) {
    return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mã xác thực.' });
  }

  try {
    // Lấy thông tin user
    const { data: user, error } = await supabase
      .from('users')
      .select('id, verification_code, code_expires_at, login_attempts')
      .eq('username_acc', username)
      .single();

    if (!user || error) {
      return res.status(404).json({ error: 'Tài khoản không tồn tại.' });
    }

    const now = new Date();

    // Kiểm tra mã đã hết hạn chưa
    if (!user.verification_code || !user.code_expires_at) {
      return res.status(400).json({ error: 'Không có mã xác thực nào được yêu cầu.', codeExpired: true });
    }

    if (new Date(user.code_expires_at) < now) {
      return res.status(410).json({ 
        error: 'Mã xác thực đã hết hạn. Vui lòng gửi lại mã mới.',
        codeExpired: true 
      });
    }

    // Kiểm tra mã có đúng không (so sánh với hash trong DB)
    const isCodeValid = await bcrypt.compare(code, user.verification_code);
    if (!isCodeValid) {
      return res.status(401).json({ error: 'Mã xác thực không đúng.' });
    }

    // Mã đúng → Reset tài khoản
    await supabase
      .from('users')
      .update({
        login_attempts: 0,
        verification_code: null,
        code_expires_at: null
      })
      .eq('id', user.id);

    logger.info(`✅ Tài khoản ${username} đã được mở khóa thành công.`);

    return res.status(200).json({
      success: true,
      message: 'Xác thực thành công! Bạn có thể đăng nhập lại.'
    });

  } catch (err) {
    logger.error('Verify unlock code error:', err);
    return res.status(500).json({ error: 'Lỗi hệ thống.' });
  }
};

// ========== 6. GỬI LẠI MÃ XÁC THỰC ==========
const resendUnlockCode = async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập.' });
  }

  try {
    // Lấy thông tin user
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, username, login_attempts')
      .eq('username_acc', username)
      .single();

    if (!user || error) {
      return res.status(404).json({ error: 'Tài khoản không tồn tại.' });
    }

    // Chỉ gửi lại nếu tài khoản đã bị khóa (login_attempts >= 5)
    if (user.login_attempts < 5) {
      return res.status(400).json({ error: 'Tài khoản chưa bị khóa.' });
    }

    const now = new Date();
    const code = generateVerificationCode();  // Mã gốc gửi email
    const codeExpiry = new Date(now.getTime() + 10 * 60 * 1000); // 10 phút
    
    // HASH mã OTP trước khi lưu vào DB
    const hashedCode = await bcrypt.hash(code, 10);

    // Cập nhật mã đã HASH vào DB
    await supabase
      .from('users')
      .update({
        verification_code: hashedCode,  // Lưu hash, không lưu mã gốc
        code_expires_at: codeExpiry.toISOString()
      })
      .eq('id', user.id);

    // Gửi email
    if (user.email) {
      const decryptedUsername = user.username ? decryptData(user.username) : 'User';
      sendVerificationCodeEmail(user.email, decryptedUsername, code)
        .then(result => {
          logger.debug(`📧 Mã mới đã được gửi:`, result);
        })
        .catch(err => {
          logger.error('❌ Không gửi được email:', err.message);
        });
    }

    logger.info(`📧 Đã gửi lại mã xác thực cho ${username}`);

    return res.status(200).json({
      success: true,
      message: 'Mã xác thực mới đã được gửi về email của bạn.'
    });

  } catch (err) {
    logger.error('Resend unlock code error:', err);
    return res.status(500).json({ error: 'Lỗi hệ thống.' });
  }
};

// ========== 7. QUÊN MẬT KHẨU - GỬI MÃ XÁC THỰC ==========
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Vui lòng nhập email.' });
  }

  try {
    // Tìm user theo email
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, username')
      .eq('email', email)
      .single();

    if (!user || error) {
      // Không tiết lộ email có tồn tại hay không (bảo mật)
      return res.status(200).json({ 
        success: true, 
        message: 'Nếu email tồn tại, mã xác thực sẽ được gửi.' 
      });
    }

    const now = new Date();
    const code = generateVerificationCode();
    const codeExpiry = new Date(now.getTime() + 10 * 60 * 1000); // 10 phút
    
    // Hash mã trước khi lưu
    const hashedCode = await bcrypt.hash(code, 10);

    // Lưu mã vào DB (dùng cột RIÊNG cho reset password)
    await supabase
      .from('users')
      .update({
        reset_password_code: hashedCode,
        reset_code_expires_at: codeExpiry.toISOString()
      })
      .eq('id', user.id);

    // Gửi email
    const decryptedUsername = user.username ? decryptData(user.username) : 'User';
    sendVerificationCodeEmail(user.email, decryptedUsername, code)
      .then(result => {
        logger.debug(`📧 Mã reset password đã gửi:`, result);
      })
      .catch(err => {
        logger.error('❌ Không gửi được email:', err.message);
      });

    logger.info(`📧 Đã gửi mã reset password cho email: ${email}`);

    return res.status(200).json({
      success: true,
      message: 'Mã xác thực đã được gửi về email của bạn.'
    });

  } catch (err) {
    logger.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Lỗi hệ thống.' });
  }
};

// ========== 8. XÁC THỰC MÃ RESET PASSWORD ==========
const verifyResetCode = async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Vui lòng nhập email và mã xác thực.' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, reset_password_code, reset_code_expires_at')
      .eq('email', email)
      .single();

    if (!user || error) {
      return res.status(404).json({ error: 'Email không tồn tại.' });
    }

    const now = new Date();

    // Kiểm tra mã hết hạn
    if (!user.reset_password_code || !user.reset_code_expires_at) {
      return res.status(400).json({ error: 'Không có mã xác thực nào được yêu cầu.' });
    }

    if (new Date(user.reset_code_expires_at) < now) {
      return res.status(410).json({ 
        error: 'Mã xác thực đã hết hạn.',
        codeExpired: true 
      });
    }

    // So sánh mã với hash
    const isCodeValid = await bcrypt.compare(code, user.reset_password_code);
    if (!isCodeValid) {
      return res.status(401).json({ error: 'Mã xác thực không đúng.' });
    }

    // Mã đúng - trả về token tạm để cho phép reset password
    // (Không xóa mã ngay, để dùng ở bước tiếp theo)
    logger.info(`✅ Mã reset password đúng cho email: ${email}`);

    return res.status(200).json({
      success: true,
      message: 'Mã xác thực đúng. Bạn có thể đặt mật khẩu mới.',
      canResetPassword: true
    });

  } catch (err) {
    logger.error('Verify reset code error:', err);
    return res.status(500).json({ error: 'Lỗi hệ thống.' });
  }
};

// ========== 9. ĐẶT MẬT KHẨU MỚI ==========
const resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, reset_password_code, reset_code_expires_at')
      .eq('email', email)
      .single();

    if (!user || error) {
      return res.status(404).json({ error: 'Email không tồn tại.' });
    }

    const now = new Date();

    // Kiểm tra mã hết hạn
    if (!user.reset_password_code || !user.reset_code_expires_at) {
      return res.status(400).json({ error: 'Không có mã xác thực nào được yêu cầu.' });
    }

    if (new Date(user.reset_code_expires_at) < now) {
      return res.status(410).json({ error: 'Mã xác thực đã hết hạn. Vui lòng yêu cầu mã mới.' });
    }

    // Xác thực mã lần nữa để đảm bảo an toàn
    const isCodeValid = await bcrypt.compare(code, user.reset_password_code);
    if (!isCodeValid) {
      return res.status(401).json({ error: 'Mã xác thực không đúng.' });
    }

    // Hash mật khẩu mới
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Cập nhật password và xóa mã reset password
    await supabase
      .from('users')
      .update({
        password: hashedPassword,
        reset_password_code: null,
        reset_code_expires_at: null,
        login_attempts: 0  // Reset số lần đăng nhập sai
      })
      .eq('id', user.id);

    logger.info(`✅ Đã reset password thành công cho email: ${email}`);

    return res.status(200).json({
      success: true,
      message: 'Đặt mật khẩu mới thành công! Bạn có thể đăng nhập.'
    });

  } catch (err) {
    logger.error('Reset password error:', err);
    return res.status(500).json({ error: 'Lỗi hệ thống.' });
  }
};

export default {
  login,
  register,
  googleLogin,
  requestRefreshToken,
  verifyUnlockCode,
  resendUnlockCode,
  forgotPassword,
  verifyResetCode,
  resetPassword
};