// TEST SCRIPT: Kiểm tra xem có update được login_attempts không
// Chạy: node test_update_login_attempts.js

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testUpdate() {
  console.log("🧪 BẮT ĐẦU TEST UPDATE login_attempts\n");

  // 1. Lấy user đầu tiên
  const { data: users, error: fetchError } = await supabase
    .from("users")
    .select("id, username_acc, login_attempts, locked_until")
    .limit(1);

  if (fetchError) {
    console.error("❌ Lỗi khi lấy user:", fetchError);
    return;
  }

  if (!users || users.length === 0) {
    console.error("❌ Không có user nào trong database");
    return;
  }

  const user = users[0];
  console.log("✅ User test:", {
    id: user.id,
    username: user.username_acc,
    login_attempts: user.login_attempts,
    locked_until: user.locked_until,
  });

  // 2. Thử update login_attempts
  console.log("\n🔄 Đang thử update login_attempts từ", user.login_attempts, "lên", (user.login_attempts || 0) + 1);

  const { data, error } = await supabase
    .from("users")
    .update({ login_attempts: (user.login_attempts || 0) + 1 })
    .eq("id", user.id)
    .select();

  if (error) {
    console.error("\n❌ LỖI KHI UPDATE:");
    console.error("Code:", error.code);
    console.error("Message:", error.message);
    console.error("Details:", error.details);
    console.error("Hint:", error.hint);
    console.error("\n📌 NGUYÊN NHÂN CÓ THỂ:");
    console.error("1. RLS (Row Level Security) đang chặn");
    console.error("2. SUPABASE_SERVICE_ROLE_KEY không đúng");
    console.error("3. Quyền truy cập bị giới hạn");
  } else {
    console.log("\n✅ UPDATE THÀNH CÔNG!");
    console.log("Dữ liệu sau khi update:", data);
  }

  // 3. Kiểm tra lại
  const { data: checkUser } = await supabase
    .from("users")
    .select("login_attempts")
    .eq("id", user.id)
    .single();

  console.log("\n🔍 Kiểm tra lại login_attempts:", checkUser?.login_attempts);
}

testUpdate();
