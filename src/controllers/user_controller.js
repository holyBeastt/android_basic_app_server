import supabase from "../config/supabase.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken"; // Nếu dùng jwt cũng phải import như thế này

// ...phần code còn lại...
const getUserInfo = async (req, res) => {
  try {
    // Lấy userId từ params hoặc body (tùy bạn truyền kiểu nào)
    const userId = req.params.userId
    if (!userId) {
      return res.status(400).json({ error: "Thiếu userId." });
    }

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();
console.log("Data:", data);
    if (error || !data) {
      return res.status(404).json({ error: "Không tìm thấy người dùng." });
    }

    return res.status(200).json({
      user: {
        id: data.id,
        username: data.username_acc,
        password: data.password,
        bio: data.bio,
        sex: data.sex,
        avatar: data.avatar_url,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server." });
  }
};
const updateUserInfo = async (req, res) => {
  const { userId } = req.params;
  const { username, oldPassword, password, bio, sex, avatar_url } = req.body;
  console.log(req.body);
  try {
    // 1. Lấy user hiện tại từ Supabase
    const { data: users, error: fetchError } = await supabase
      .from("users")
      .select("password")
      .eq("id", userId)
      .single();

    if (fetchError || !users) {
      return res.status(404).json({ error: "Người dùng không tồn tại." });
    }

    // 2. Nếu người dùng muốn đổi mật khẩu, kiểm tra mật khẩu cũ
    let hashedPassword = null;

    if (password && password.trim() !== "") {
      const isMatch = await bcrypt.compare(oldPassword, users.password);

      if (!isMatch) {
        return res.status(400).json({ error: "Mật khẩu cũ không chính xác." });
      }

      // Nếu đúng, hash mật khẩu mới
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // 3. Tạo object cập nhật
    const updateFields = {
      username_acc: username,
      bio: bio,
      sex: sex,
      avatar_url: avatar_url,
    };

    if (hashedPassword) {
      updateFields.password = hashedPassword;
    }

    // 4. Cập nhật user
    const { data, error } = await supabase
      .from("users")
      .update(updateFields)
      .eq("id", userId)
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ message: "Cập nhật thành công!", user: data[0] });
  } catch (err) {
    console.error("Lỗi cập nhật:", err);
    return res.status(500).json({ error: "Lỗi server." });
  }
};

export default {
  getUserInfo,
  updateUserInfo,

  // ...các hàm khác
};
