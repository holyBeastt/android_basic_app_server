import supabase from "../config/supabase.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import path from "path";

// Helper upload avatar to Supabase
async function uploadAvatarToSupabase(file, userId) {
  if (!file) return null;
  const ext = path.extname(file.originalname);
  const fileName = `avatars/${userId}_${Date.now()}${ext}`;
  const { data, error } = await supabase.storage
    .from("images")
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });
  if (error) throw new Error("Lỗi upload avatar: " + error.message);
  const { data: publicUrlData } = supabase.storage.from("images").getPublicUrl(fileName);
  return publicUrlData?.publicUrl || null;
}

const getUserInfo = async (req, res) => {
  try {
    // Lấy userId từ params hoặc body (tùy bạn truyền kiểu nào)
    const userId = req.params.userId
    console.log("userId:=======", userId);
    if (!userId) {
      return res.status(400).json({ error: "Thiếu userId." });
    }

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();
    if (error || !data) {
      return res.status(404).json({ error: "Không tìm thấy người dùng." });
    }
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server." });
  }
};
const updateUserInfo = async (req, res) => {
  const { userId } = req.params;
  const { username, oldPassword, password, bio, sex } = req.body;
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
      username: username,
      bio: bio,
      sex: sex,
    };
    // Nếu có file avatar upload
    if (req.file) {
      try {
        const url = await uploadAvatarToSupabase(req.file, userId);
        updateFields.avatar_url = url;
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
    } else if (req.body.avatar_url) {
      updateFields.avatar_url = req.body.avatar_url;
    }

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
