import supabase from "../config/supabase.js";
import bcrypt from "bcrypt";
import { OAuth2Client } from 'google-auth-library';
import jwt from "jsonwebtoken";


const login = async (req, res) => {
  const { username, password } = req.body;
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] [LOGIN ATTEMPT] Username: ${username}`);

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("username_acc", username)
    .single();

  if (!user || error) {
    console.log(`[${timestamp}] [LOGIN FAILED] Username: ${username} - Reason: Username not found`);
    return res.status(401).json({ error: "Tên đăng nhập không tồn tại." });
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    console.log(`[${timestamp}] [LOGIN FAILED] Username: ${username} - Reason: Incorrect password`);
    return res.status(401).json({ error: "Sai mật khẩu." });
  }

  const secret_key = process.env.JWT_SECRET;

  const token = jwt.sign({ id: user.id, username: user.username }, secret_key, {
    expiresIn: "1d",
  });

  // Tạo message dựa trên loại tài khoản
  const loginMessage = user.is_instructor
    ? "Đăng nhập thành công với tư cách giảng viên"
    : "Đăng nhập thành công với tư cách học viên";

  console.log(`[${timestamp}] [LOGIN SUCCESS] Username: ${username} - User ID: ${user.id} - Account type: ${user.is_instructor ? 'Instructor' : 'Student'}`);

  return res.status(200).json({
    message: loginMessage,
    user: { id: user.id, username: user.username, is_instructor: user.is_instructor },
    token,
  });
};

const register = async (req, res) => {
  const { username_acc, password, confirmPassword, username, sex } = req.body;
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] [REGISTER ATTEMPT] Username_acc: ${username_acc}`);

  // Kiểm tra các trường bắt buộc
  if (!username_acc || !password || !username || !sex) {
    console.log(`[${timestamp}] [REGISTER FAILED] Username_acc: ${username_acc} - Reason: Missing required fields`);
    return res.status(400).json({ error: "Vui lòng điền đầy đủ thông tin bắt buộc." });
  }

  // Kiểm tra giới tính hợp lệ
  if (!['male', 'female', 'other'].includes(sex)) {
    console.log(`[${timestamp}] [REGISTER FAILED] Username_acc: ${username_acc} - Reason: Invalid sex value`);
    return res.status(400).json({ error: "Giới tính không hợp lệ. Chọn: male, female, hoặc other." });
  }

  // Kiểm tra xem username_acc đã tồn tại chưa
  const { data: existingUser } = await supabase
    .from("users")
    .select("*")
    .eq("username_acc", username_acc)
    .single();

  if (existingUser) {
    console.log(`[${timestamp}] [REGISTER FAILED] Username_acc: ${username_acc} - Reason: Username already exists`);
    return res.status(400).json({ error: "Tên đăng nhập đã tồn tại." });
  }

  // Mã hóa mật khẩu
  const hashedPassword = await bcrypt.hash(password, 10);

  // Thêm vào bảng account
  const { data, error } = await supabase
    .from("users")
    .insert([{
      username_acc: username_acc,
      password: hashedPassword,
      username: username,
      sex: sex
    }])
    .select();

  if (error) {
    console.log(`[${timestamp}] [REGISTER FAILED] Username_acc: ${username_acc} - Reason: Database error - ${error.message}`);
    return res.status(500).json({ error: "Lỗi khi tạo tài khoản." });
  }

  console.log(`[${timestamp}] [REGISTER SUCCESS] Username_acc: ${username_acc} - User ID: ${data[0].id} - Username: ${username} - Sex: ${sex}`);

  return res.status(201).json({
    message: "Đăng ký thành công",
    account: {
      id: data[0].id,
      username_acc: data[0].username_acc,
      username: data[0].username,
      sex: data[0].sex
    },
  });
};

// Config
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

export default {
  login,
  register,
  googleLogin
};
