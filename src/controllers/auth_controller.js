// controllers/auth_controller.js
import supabase from "../config/supabase.js";
import bcrypt from "bcrypt";

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
    user: { id: user.id, username: user.username, is_instructor:  user.is_instructor },
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

export default {
  login,
  register,
};
