// controllers/auth_controller.js
import supabase from "../config/supabase.js";
import bcrypt from "bcrypt";

import jwt from "jsonwebtoken";

const login = async (req, res) => {
  const { username, password } = req.body;

  const { data: user, error } = await supabase
    .from("account")
    .select("*")
    .eq("username", username)
    .single();

  if (!user || error) {
    return res.status(401).json({ error: "Tên đăng nhập không tồn tại." });
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    return res.status(401).json({ error: "Sai mật khẩu." });
  }

  const secret_key = process.env.JWT_SECRET;

  const token = jwt.sign({ id: user.id, username: user.username }, secret_key, {
    expiresIn: "1d",
  });

  return res.status(200).json({
    message: "Đăng nhập thành công",
    user: { id: user.id, username: user.username },
    token,
  });
};

const register = async (req, res) => {
  const { username, password, confirmPassword } = req.body;

  // Kiểm tra xem username đã tồn tại chưa
  const { data: existingUser } = await supabase
    .from("account")
    .select("*")
    .eq("username", username)
    .single();

  if (existingUser) {
    return res.status(400).json({ error: "Tên đăng nhập đã tồn tại." });
  }

  // Mã hóa mật khẩu
  const hashedPassword = await bcrypt.hash(password, 10);

  // Thêm vào bảng account
  const { data, error } = await supabase
    .from("account")
    .insert([{ username, password: hashedPassword }])
    .select();

  if (error) {
    return res.status(500).json({ error: "Lỗi khi tạo tài khoản." });
  }

  return res.status(201).json({
    message: "Đăng ký thành công",
    account: data[0],
  });
};

export default {
  login,
  register,
};
