import supabase from "../config/supabase.js";

const enrollCourse = async (req, res) => {
  const { courseId } = req.params;
  const { userId } = req.body;

  if (!courseId || !userId) {
    return res.status(400).json({ error: "Thiếu thông tin khóa học hoặc người dùng." });
  }

  try {
    // Kiểm tra xem người dùng đã đăng ký khóa học chưa
    const { data: existingEnrollment, error: checkError } = await supabase
      .from("enrollments")
      .select("*")
      .eq("course_id", courseId)
      .eq("user_id", userId)
      .maybeSingle(); 

    if (checkError) {
      console.error("Lỗi khi kiểm tra đăng ký:", checkError.message);
      return res.status(500).json({ error: "Không thể kiểm tra đăng ký." });
    }

    if (existingEnrollment) {
      return res.status(400).json({ error: "Bạn đã đăng ký khóa học này rồi." });
    }

    // Thêm đăng ký mới
    const { data, error } = await supabase
      .from("enrollments")
      .insert([{ course_id: courseId, user_id: userId }]);

    if (error) {
      console.error("Lỗi khi thêm đăng ký:", error.message);
      return res.status(500).json({ error: "Không thể đăng ký khóa học." });
    }

    return res.status(200).json({ message: "Đăng ký thành công!", enrollment: data });
  } catch (err) {
    console.error("Lỗi không xác định:", err);
    return res.status(500).json({ error: "Đã xảy ra lỗi máy chủ." });
  }
}
const getEnrollments = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "Thiếu thông tin người dùng." });
  }

  try {
    const { data: enrollments, error } = await supabase
      .from("enrollments")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      console.error("Lỗi khi lấy danh sách đăng ký:", error.message);
      return res.status(500).json({ error: "Không thể lấy danh sách đăng ký." });
    }

    return res.status(200).json(enrollments);
  } catch (err) {
    console.error("Lỗi không xác định:", err);
    return res.status(500).json({ error: "Đã xảy ra lỗi máy chủ." });
  }
};  
const unenrollCourse = async (req, res) => {
  const { courseId } = req.params;
  const { userId } = req.body;

  if (!courseId || !userId) {
    return res.status(400).json({ error: "Thiếu thông tin khóa học hoặc người dùng." });
  }

  try {
    const { data, error } = await supabase
      .from("enrollments")
      .delete()
      .eq("course_id", courseId)
      .eq("user_id", userId);

    if (error) {
      console.error("Lỗi khi hủy đăng ký:", error.message);
      return res.status(500).json({ error: "Không thể hủy đăng ký khóa học." });
    }

    return res.status(200).json({ message: "Hủy đăng ký thành công!", data });
  } catch (err) {
    console.error("Lỗi không xác định:", err);
    return res.status(500).json({ error: "Đã xảy ra lỗi máy chủ." });
  }
};
const checkEnrolled = async (req, res) => {
  const { courseId } = req.params;
    const { userId } = req.query;
console.log("courseId:======= ", courseId, "userId:======== ", userId);
  // Kiểm tra userId đã đăng ký courseId chưa
  const { data, error } = await supabase
    .from("enrollments")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle(); 

  if (error || !data) {
    return res.json({ enrolled: false });
  }
  return res.json({ enrolled: true });
};
export default {
  enrollCourse,
  getEnrollments,
    unenrollCourse,
    checkEnrolled,
};