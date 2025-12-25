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
const getCourseWithCategory = async (req, res) => {
  const category = req.params.category;
  console.log("category =============", category);

  try {
    // Chỉ select từ bảng courses, không join với bảng categories
    const { data: courses, error: courseError } = await supabase
      .from("courses")
      .select("*") // Chỉ lấy từ bảng courses
      .eq("category_name", category) // Lọc theo thuộc tính category_name
      .order("created_at", { ascending: false }); // Sắp xếp theo thời gian tạo
    console.log("courses =============", courses);
    if (courseError) {
      console.error("Lỗi khi lấy khóa học:", courseError.message);
      return res
        .status(500)
        .json({ error: "Không thể lấy thông tin khóa học." });
    }

    console.log(
      `Tìm thấy ${courses.length} khóa học cho category: ${category}`
    );

    // Trả về array courses giống như getTopCoursesList
    return res.status(200).json(courses);
  } catch (err) {
    console.error("Lỗi không xác định:", err);
    return res.status(500).json({ error: "Đã xảy ra lỗi máy chủ." });
  }
};
const getCourseWithSearch = async (req, res) => {
  const searchQuery = req.query.query;
  console.log("searchQuery =", searchQuery);
  if (!searchQuery || searchQuery.trim() === "") {
    return res
      .status(400)
      .json({ error: "Truy vấn tìm kiếm không được để trống." });
  }
  try {
    // Tìm kiếm khóa học theo tên hoặc mô tả
    const { data: courses, error: courseError } = await supabase
      .from("courses")
      .select("*")
      .or(
        `title.ilike.%${searchQuery}%,subtitle.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
      )
      .order("created_at", { ascending: false });
    console.log("courses ======", courses);
    if (courseError) {
      console.error("Lỗi khi tìm kiếm khóa học:", courseError.message);
      return res.status(500).json({ error: "Không thể tìm kiếm khóa học." });
    }

    console.log(
      `Tìm thấy ${courses.length} khóa học cho truy vấn: ${searchQuery}`
    );

    return res.status(200).json(courses);
  } catch (err) {
    console.error("Lỗi không xác định:", err);
    return res.status(500).json({ error: "Đã xảy ra lỗi máy chủ." });
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


  console.log("section = ", sections)

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
const addReview = async (req, res) => {
  const courseId = req.params.id;
  const { user_id, user_name, rating, comment } = req.body;

  console.log("Thông tin bổ ích ========", courseId, user_id, user_name, rating, comment);

  if (!user_id || !user_name || !rating || !comment) {
    return res.status(400).json({ error: "Thiếu thông tin đánh giá." });
  }

  const { error } = await supabase.from("reviews").insert([
    {
      course_id: courseId,
      user_id,
      user_name,
      rating,
      comment,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // ✅ Đây mới là cách trả phản hồi đúng
  return res.status(201).json({ message: "Đánh giá đã được gửi thành công." });
};


const getTeacherInfo = async (req, res) => {
  const userId = req.params.id;

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

const getSignedUrl = async (req, res) => {
  const timestamp = new Date().toISOString();
  try {
    const userId = req.user.id;
    const { lessonId } = req.params;

    console.log(`[${timestamp}] --- BẮT ĐẦU KIỂM TRA VIDEO ---`);
    console.log(`[DEBUG] Input -> userId: ${userId}, lessonId: ${lessonId}`);

    // 1. Lấy thông tin bài học và Join
    const { data: lessonData, error: lessonError } = await supabase
      .from('lessons')
      .select(`
        content_url,
        course_id,
        courses:course_id (
          user_id
        )
      `)
      .eq('id', lessonId)
      .single();

    if (lessonError || !lessonData) {
      console.error(`[ERROR 1] Truy vấn bài học thất bại:`, lessonError?.message || "Không tìm thấy data");
      return res.status(404).json({ error: "Bài học không tồn tại" });
    }

    const courseId = lessonData.course_id;
    const instructorId = lessonData.courses?.user_id;
    console.log(`[DEBUG] Lesson Data -> courseId: ${courseId}, instructorId: ${instructorId}`);
    console.log(`[DEBUG] Content URL từ DB: "${lessonData.content_url}"`);

    let hasAccess = false;

    // 2. KIỂM TRA QUYỀN TRUY CẬP
    if (userId === instructorId) {
      console.log("[CHECK] Kết quả: TRÙNG KHỚP (User là Giảng viên)");
      hasAccess = true;
    } else {
      console.log(`[CHECK] Đang kiểm tra thanh toán cho User: ${userId} tại Course: ${courseId}...`);
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select('id, status')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .eq('status', 'PAID')
        .maybeSingle();

      if (paymentError) console.error(`[ERROR 2] Lỗi truy vấn payment:`, paymentError.message);

      if (payment) {
        console.log(`[CHECK] Kết quả: ĐÃ THANH TOÁN (Payment ID: ${payment.id})`);
        hasAccess = true;
      } else {
        console.warn(`[CHECK] Kết quả: TỪ CHỐI (Không tìm thấy bản ghi PAID)`);
      }
    }

    // 3. XỬ LÝ KHI KHÔNG CÓ QUYỀN
    if (!hasAccess) {
      return res.status(403).json({ error: "Bạn không có quyền truy cập bài học này." });
    }

    // 4. TẠO SIGNED URL
    // KIỂM TRA: content_url có bắt đầu bằng dấu "/" hay không? 
    // Supabase đôi khi yêu cầu bỏ dấu "/" ở đầu nếu là đường dẫn tương đối.
    const cleanPath = lessonData.content_url.startsWith('/')
      ? lessonData.content_url.substring(1)
      : lessonData.content_url;

    console.log(`[DEBUG] Đang tạo Signed URL cho path: "${cleanPath}" trong bucket: "videos"`);

    const { data, error: storageError } = await supabase.storage
      .from('videos')
      .createSignedUrl(cleanPath, 20);

    if (storageError) {
      console.error(`[ERROR 3] Storage Error:`, storageError.message);
      // Log thêm để kiểm tra nếu bucket tên là "videos" có tồn tại không
      return res.status(400).json({ error: "Lỗi Storage", detail: storageError.message });
    }

    if (!data?.signedUrl) {
      console.error(`[ERROR 4] Không tạo được signedUrl mặc dù không có lỗi storage.`);
      return res.status(500).json({ error: "Lỗi tạo link" });
    }

    console.log(`[SUCCESS] Đã tạo thành công Signed URL.`);
    console.log(`[URL] -> ${data.signedUrl}`);

    return res.status(200).json({ signedUrl: data.signedUrl });

  } catch (err) {
    console.error(`[FATAL ERROR]`, err);
    return res.status(500).json({ error: "Lỗi hệ thống" });
  }
};

export default {
  getTopCoursesList,
  getCourseSectionsWithLessons,
  getCourseWithCategory,
  getCourseWithSearch,
  getReviews,
  addReview,
  getTeacherInfo,
  getSignedUrl,
};
