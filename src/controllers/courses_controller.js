// controllers/auth_controller.js
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

const getCourseSectionsWithLessons = async (req, res) => {
  const courseId = req.params.id;

  console.log("course =", courseId);

  const { data: sections, error: sectionError } = await supabase
    .from("sections")
    .select("*, lessons(*)") // Lấy cả các bài học trong phần học
    .eq("course_id", courseId)
    .order("order_index", { ascending: true });

  if (sectionError) {
    console.log("Xảy ra lỗi khi lấy dữ liệu phần học, bài học");
    return res.status(500).json({ error: sectionError.message });
  }

  return res.status(200).json(sections);
};

const getReviews = async (req, res) => {
  const courseId = req.params.id;

  const { data: reviews, error: sectionError } = await supabase
    .from("reviews")
    .select("*") // Lấy cả các bài học trong phần học
    .eq("course_id", courseId);

  if (sectionError) {
    console.log("Xảy ra lỗi khi lấy dữ liệu reviews");
    return res.status(500).json({ error: sectionError.message });
  }

  return res.status(200).json(reviews);
};

const getTeacherInfo = async (req, res) => {
  const userId = req.params.id;

  console.log("user id = ", userId);

  try {
    // Lấy thông tin giảng viên
    const { data: teacherInfo, error: teacherError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single(); // vì mỗi user_id là duy nhất

    if (teacherError) {
      console.error("Lỗi khi lấy thông tin giảng viên:", teacherError.message);
      return res
        .status(500)
        .json({ error: "Không thể lấy thông tin giảng viên." });
    }

    // Lấy danh sách các khóa học của giảng viên đó
    const { data: courseList, error: courseError } = await supabase
      .from("courses")
      .select("*")
      .eq("user_id", userId);

    if (courseError) {
      console.error("Lỗi khi lấy danh sách khóa học:", courseError.message);
      return res
        .status(500)
        .json({ error: "Không thể lấy danh sách khóa học của giảng viên." });
    }

    return res.status(200).json({
      teacher: teacherInfo,
      courses: courseList,
    });
  } catch (err) {
    console.error("Lỗi không xác định:", err);
    return res.status(500).json({ error: "Đã xảy ra lỗi máy chủ." });
  }
};

export default {
  getTopCoursesList,
  getCourseSectionsWithLessons,
  getReviews,
  getTeacherInfo,
};
