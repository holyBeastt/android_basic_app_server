import supabase from "../config/supabase.js";

const getTopCoursesList = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Lỗi Supabase:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Lỗi server:", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
};

// Lấy danh sách khóa học sở hữu, đã mua
const getPersonalCourses = async (req, res) => {
  const userId = req.params.id;
  console.log("hôh");

  try {
    // Lấy danh sách khóa học do user sở hữu (tự tạo)
    const { data: ownedCourses, error: ownedCoursesError } = await supabase
      .from("courses")
      .select("*")
      .eq("user_id", userId);

    console.log("hẹ hẹ");

    if (ownedCoursesError) {
      console.error("Lỗi khi lấy khóa học sở hữu:", ownedCoursesError.message);
      return res
        .status(500)
        .json({ error: "Không thể lấy thông tin khóa học sở hữu." });
    }

    // Lấy danh sách khóa học đã mua kèm thông tin khóa học
    const { data: enrolledCourses, error: enrolledError } = await supabase
      .from("enrollments")
      .select("*, courses:course_id (*)") // lấy thông tin khóa học qua course_id
      .eq("user_id", userId);

    if (enrolledError) {
      console.error(
        "Lỗi khi lấy danh sách khóa học đã mua:",
        enrolledError.message
      );
      return res
        .status(500)
        .json({ error: "Không thể lấy danh sách khóa học đã mua." });
    }

    return res.status(200).json({
      ownedCourses,
      enrolledCourses,
    });
  } catch (err) {
    console.error("Lỗi không xác định:", err);
    return res.status(500).json({ error: "Đã xảy ra lỗi máy chủ." });
  }
};

export default {
  getTopCoursesList,
  getPersonalCourses,
};
