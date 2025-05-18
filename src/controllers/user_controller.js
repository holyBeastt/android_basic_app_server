import supabase from "../config/supabase.js";

const getUserInfo = async (req, res) => {
  const decoded = jwt.verify(token, secret_key);
  console.log(decoded.id); // Dùng để truy vấn DB

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("username_acc", username);

  if (!user || error) {
    return res.status(401).json({ error: "Tên đăng nhập không tồn tại." });
  }

  return res.status(200).json({
    message: "Đăng nhập thành công",
    user: { id: user.id, username: user.username },
    token,
  });
};

export default {
  login,
  register,
};
