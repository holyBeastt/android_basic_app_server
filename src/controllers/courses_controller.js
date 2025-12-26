// controllers/auth_controller.js
import supabase from "../config/supabase.js";
import { decryptData } from "../utils/crypto.js";

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

  if (sectionError) {
    console.log("Xảy ra lỗi khi lấy dữ liệu phần học, bài học");
    return res.status(500).json({ error: sectionError.message });
  }

  return res.status(200).json(sections);
};

const getReviews = async (req, res) => {
  const courseId = req.params.id;
  console.log("courseId:======= ", courseId);

  try {
    // 1. Lấy tất cả reviews của khóa học
    const { data: reviews, error: reviewError } = await supabase
      .from("reviews")
      .select("id, course_id, user_id, rating, comment, created_at")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });

    if (reviewError) {
      console.error("Xảy ra lỗi khi lấy dữ liệu reviews:", reviewError.message);
      return res.status(500).json({ error: reviewError.message });
    }

    // 2. Lấy danh sách user_id duy nhất từ reviews
    const userIds = [...new Set(reviews.map(r => r.user_id))];

    // 3. Truy vấn thông tin users
    let usersMap = {};
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, username")
        .in("id", userIds);

      if (!usersError && users) {
        users.forEach(user => {
          usersMap[user.id] = user.username;
        });
      }
    }

    // 4. Giải mã username và merge vào reviews
    const decryptedReviews = reviews.map(review => {
      let decryptedUsername = "Người dùng ẩn danh";
      
      const encryptedUsername = usersMap[review.user_id];
      if (encryptedUsername) {
        try {
          decryptedUsername = decryptData(encryptedUsername);
        } catch (err) {
          console.error("Lỗi giải mã username:", err);
        }
      }

      return {
        id: review.id,
        course_id: review.course_id,
        user_id: review.user_id,
        user_name: decryptedUsername,
        rating: review.rating,
        comment: review.comment,
        created_at: review.created_at
      };
    });

    return res.status(200).json(decryptedReviews);

  } catch (err) {
    console.error("Lỗi không xác định trong getReviews:", err);
    return res.status(500).json({ error: "Lỗi hệ thống" });
  }
};
// const addReview = async (req, res) => {
//   const courseId = req.params.id;
//   const { user_id, user_name, rating, comment } = req.body;

//   console.log("Thông tin bổ ích ========", courseId, user_id, user_name, rating, comment);

//   if (!user_id || !user_name || !rating || !comment) {
//     return res.status(400).json({ error: "Thiếu thông tin đánh giá." });
//   }

//   const { error } = await supabase.from("reviews").insert([
//     {
//       course_id: courseId,
//       user_id,
//       user_name,
//       rating,
//       comment,
//       created_at: new Date().toISOString(),
//     },
//   ]);

//   if (error) {
//     return res.status(500).json({ error: error.message });
//   }

//   // ✅ Đây mới là cách trả phản hồi đúng
//   return res.status(201).json({ message: "Đánh giá đã được gửi thành công." });
// };

const addReview = async (req, res) => {
  const courseId = req.params.id;
  const { rating, comment } = req.body;
  const userId = req.user.id;

  console.log(`\n[DEBUG - addReview] --- BẮT ĐẦU ---`);

  try {
    if (!rating || !comment || rating < 1 || rating > 5) {
      console.warn(`[DEBUG] Thất bại: Dữ liệu đầu vào không hợp lệ hoặc thiếu.`);
      return res.status(400).json({ error: "Dữ liệu đánh giá không hợp lệ." });
    }

    console.log(`[DEBUG] Đang kiểm tra xem User ${userId} đã đánh giá Course ${courseId} chưa...`);

    // 1. Kiểm tra review đã tồn tại
    const { data: existingReview } = await supabase
      .from("reviews")
      .select("id")
      .eq("course_id", courseId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingReview) {
      console.warn(`[DEBUG] Chặn: User ${userId} đã có review (ID: ${existingReview.id})`);
      return res.status(400).json({ error: "Bạn đã đánh giá khóa học này rồi." });
    }

    // 2. THAY ĐỔI: Kiểm tra ghi danh (enrollment) thay vì thanh toán
    console.log(`[DEBUG] Đang xác thực ghi danh cho User ${userId}...`);
    const { data: enrollment, error: enrollError } = await supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (enrollError) throw enrollError;

    if (!enrollment) {
      console.warn(`[DEBUG] Từ chối: User ${userId} chưa ghi danh vào khóa học ${courseId}.`);
      return res.status(403).json({ error: "Bạn cần đăng ký khóa học để thực hiện đánh giá." });
    }

    // 3. Lấy thông tin User để lấy username
    const { data: userData } = await supabase
      .from("users")
      .select("username")
      .eq("id", userId)
      .single();

    // 4. Insert dữ liệu (Chống SQL Injection)
    const { error: insertError } = await supabase.from("reviews").insert([
      {
        course_id: courseId,
        user_id: userId,
        user_name: userData.username,
        rating: rating,
        comment: comment,
        created_at: new Date().toISOString(),
      },
    ]);

    if (insertError) throw insertError;

    return res.status(201).json({ message: "Đánh giá đã được gửi thành công." });

  } catch (err) {
    console.error(`[CRITICAL] Lỗi hệ thống trong hàm addReview:`, err.message);
    return res.status(500).json({ error: "Lỗi hệ thống khi gửi đánh giá." });
  }
};

// Kiểm tra xem user đã đánh giá khóa học chưa
const checkUserReview = async (req, res) => {
  const courseId = req.params.id;
  const userId = req.user.id;
  console.log("\n[CHECK-REVIEW] ===== BẮT ĐẦU =====");
  console.log("[CHECK-REVIEW] courseId:", courseId, "userId:", userId);

  try {
    // 1. Kiểm tra review của user trong khóa học
    const { data: review, error } = await supabase
      .from("reviews")
      .select("id, course_id, user_id, rating, comment, created_at")
      .eq("course_id", courseId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[CHECK-REVIEW] Lỗi khi kiểm tra review:", error.message);
      return res.status(500).json({ error: "Lỗi hệ thống khi kiểm tra đánh giá." });
    }

    console.log("[CHECK-REVIEW] Kết quả query:", review);

    // Nếu không có review, trả về hasReviewed: false
    if (!review) {
      console.log("[CHECK-REVIEW] => Chưa có review, trả về hasReviewed: false");
      return res.status(200).json({
        hasReviewed: false,
        review: null
      });
    }
    
    console.log("[CHECK-REVIEW] => Đã có review ID:", review.id);

    // 2. Lấy thông tin username từ bảng users
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("username")
      .eq("id", userId)
      .single();

    // 3. Giải mã username
    let decryptedUsername = "Người dùng ẩn danh";
    if (!userError && userData && userData.username) {
      try {
        decryptedUsername = decryptData(userData.username);
      } catch (err) {
        console.error("Lỗi giải mã username:", err);
      }
    }

    // Trả về review với username đã giải mã
    const decryptedReview = {
      id: review.id,
      course_id: review.course_id,
      user_id: review.user_id,
      user_name: decryptedUsername,
      rating: review.rating,
      comment: review.comment,
      created_at: review.created_at
    };

    return res.status(200).json({
      hasReviewed: true,
      review: decryptedReview
    });

  } catch (err) {
    console.error("Lỗi không xác định trong checkUserReview:", err.message);
    return res.status(500).json({ error: "Lỗi hệ thống." });
  }
};

const getTeacherInfo = async (req, res) => {
  const userId = req.params.id;

  try {
    // 1. Chỉ lấy các trường cần thiết, tránh lấy password/token hash
    const { data: teacherInfo, error: teacherError } = await supabase
      .from("users")
      .select("id, username, avatar_url, bio, is_instructor") // Liệt kê cụ thể các cột
      .eq("id", userId)
      .single();

    if (teacherError || !teacherInfo) {
      console.error("Lỗi khi lấy thông tin giảng viên:", teacherError?.message);
      return res.status(404).json({ error: "Không tìm thấy giảng viên." });
    }

    // 2. GIẢI MÃ DỮ LIỆU (Đây là phần quan trọng bạn đang thiếu)
    try {
      if (teacherInfo.username) {
        teacherInfo.username = decryptData(teacherInfo.username);
      }
      if (teacherInfo.bio) {
        teacherInfo.bio = decryptData(teacherInfo.bio);
      }
    } catch (decryptErr) {
      console.error("Lỗi khi giải mã thông tin giảng viên:", decryptErr);
      // Có thể giữ nguyên nếu dữ liệu chưa bị mã hóa hoặc lỗi key
    }

    // 3. Lấy danh sách khóa học
    const { data: courseList, error: courseError } = await supabase
      .from("courses")
      .select("*")
      .eq("user_id", userId);

    if (courseError) {
      console.error("Lỗi khi lấy danh sách khóa học:", courseError.message);
      return res.status(500).json({ error: "Không thể lấy danh sách khóa học." });
    }

    // Trả về kết quả sạch cho Frontend
    return res.status(200).json({
      teacher: teacherInfo,
      courses: courseList || [],
    });

  } catch (err) {
    console.error("Lỗi không xác định:", err);
    return res.status(500).json({ error: "Đã xảy ra lỗi máy chủ." });
  }
};

// const getSignedUrl = async (req, res) => {
//   const timestamp = new Date().toISOString();
//   try {
//     const userId = req.user.id;
//     const { lessonId } = req.params;

//     console.log(`[${timestamp}] --- BẮT ĐẦU KIỂM TRA VIDEO ---`);
//     console.log(`[DEBUG] Input -> userId: ${userId}, lessonId: ${lessonId}`);

//     // 1. Lấy thông tin bài học và Join
//     const { data: lessonData, error: lessonError } = await supabase
//       .from('lessons')
//       .select(`
//         content_url,
//         course_id,
//         courses:course_id (
//           user_id
//         )
//       `)
//       .eq('id', lessonId)
//       .single();

//     if (lessonError || !lessonData) {
//       console.error(`[ERROR 1] Truy vấn bài học thất bại:`, lessonError?.message || "Không tìm thấy data");
//       return res.status(404).json({ error: "Bài học không tồn tại" });
//     }

//     const courseId = lessonData.course_id;
//     const instructorId = lessonData.courses?.user_id;
//     console.log(`[DEBUG] Lesson Data -> courseId: ${courseId}, instructorId: ${instructorId}`);
//     console.log(`[DEBUG] Content URL từ DB: "${lessonData.content_url}"`);

//     let hasAccess = false;

//     // 2. KIỂM TRA QUYỀN TRUY CẬP
//     if (userId === instructorId) {
//       console.log("[CHECK] Kết quả: TRÙNG KHỚP (User là Giảng viên)");
//       hasAccess = true;
//     } else {
//       console.log(`[CHECK] Đang kiểm tra thanh toán cho User: ${userId} tại Course: ${courseId}...`);
//       const { data: payment, error: paymentError } = await supabase
//         .from('payments')
//         .select('id, status')
//         .eq('user_id', userId)
//         .eq('course_id', courseId)
//         .eq('status', 'PAID')
//         .maybeSingle();

//       if (paymentError) console.error(`[ERROR 2] Lỗi truy vấn payment:`, paymentError.message);

//       if (payment) {
//         console.log(`[CHECK] Kết quả: ĐÃ THANH TOÁN (Payment ID: ${payment.id})`);
//         hasAccess = true;
//       } else {
//         console.warn(`[CHECK] Kết quả: TỪ CHỐI (Không tìm thấy bản ghi PAID)`);
//       }
//     }

//     // 3. XỬ LÝ KHI KHÔNG CÓ QUYỀN
//     if (!hasAccess) {
//       return res.status(403).json({ error: "Bạn không có quyền truy cập bài học này." });
//     }

//     // 4. TẠO SIGNED URL
//     // KIỂM TRA: content_url có bắt đầu bằng dấu "/" hay không? 
//     // Supabase đôi khi yêu cầu bỏ dấu "/" ở đầu nếu là đường dẫn tương đối.
//     const cleanPath = lessonData.content_url.startsWith('/')
//       ? lessonData.content_url.substring(1)
//       : lessonData.content_url;

//     console.log(`[DEBUG] Đang tạo Signed URL cho path: "${cleanPath}" trong bucket: "videos"`);

//     const { data, error: storageError } = await supabase.storage
//       .from('videos')
//       .createSignedUrl(cleanPath, 20);

//     if (storageError) {
//       console.error(`[ERROR 3] Storage Error:`, storageError.message);
//       // Log thêm để kiểm tra nếu bucket tên là "videos" có tồn tại không
//       return res.status(400).json({ error: "Lỗi Storage", detail: storageError.message });
//     }

//     if (!data?.signedUrl) {
//       console.error(`[ERROR 4] Không tạo được signedUrl mặc dù không có lỗi storage.`);
//       return res.status(500).json({ error: "Lỗi tạo link" });
//     }

//     console.log(`[SUCCESS] Đã tạo thành công Signed URL.`);
//     console.log(`[URL] -> ${data.signedUrl}`);

//     return res.status(200).json({ signedUrl: data.signedUrl });

//   } catch (err) {
//     console.error(`[FATAL ERROR]`, err);
//     return res.status(500).json({ error: "Lỗi hệ thống" });
//   }
// };

const getSignedUrl = async (req, res) => {
  const timestamp = new Date().toISOString();
  try {
    const userId = req.user.id;
    const { lessonId } = req.params;

    console.log(`[${timestamp}] --- BẮT ĐẦU KIỂM TRA VIDEO ---`);
    console.log(`[DEBUG] Input -> userId: ${userId}, lessonId: ${lessonId}`);

    // 1. Lấy thông tin bài học và Join để lấy instructorId
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

    let hasAccess = false;

    // 2. KIỂM TRA QUYỀN TRUY CẬP
    if (userId === instructorId) {
      console.log("[CHECK] Kết quả: TRÙNG KHỚP (User là Giảng viên)");
      hasAccess = true;
    } else {
      // THAY ĐỔI: Kiểm tra trong bảng enrollments thay vì payments
      console.log(`[CHECK] Đang kiểm tra ghi danh cho User: ${userId} tại Course: ${courseId}...`);
      const { data: enrollment, error: enrollError } = await supabase
        .from('enrollments') // Đổi tên bảng
        .select('id')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .maybeSingle();

      if (enrollError) console.error(`[ERROR 2] Lỗi truy vấn enrollment:`, enrollError.message);

      if (enrollment) {
        console.log(`[CHECK] Kết quả: ĐÃ GHI DANH (Enrollment ID: ${enrollment.id})`);
        hasAccess = true;
      } else {
        console.warn(`[CHECK] Kết quả: TỪ CHỐI (Không tìm thấy bản ghi ghi danh)`);
      }
    }

    // 3. XỬ LÝ KHI KHÔNG CÓ QUYỀN
    if (!hasAccess) {
      return res.status(403).json({ error: "Bạn không có quyền truy cập bài học này." });
    }

    // 4. TẠO SIGNED URL (Giữ nguyên logic cũ)
    const cleanPath = lessonData.content_url.startsWith('/')
      ? lessonData.content_url.substring(1)
      : lessonData.content_url;

    console.log(`[DEBUG] Đang tạo Signed URL cho path: "${cleanPath}" trong bucket: "videos"`);

    const { data, error: storageError } = await supabase.storage
      .from('videos')
      .createSignedUrl(cleanPath, 60); // Tăng lên 60s để ổn định hơn

    if (storageError) {
      return res.status(400).json({ error: "Lỗi Storage", detail: storageError.message });
    }

    console.log(`[SUCCESS] Đã tạo thành công Signed URL.`);
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
  checkUserReview,
  getTeacherInfo,
  getSignedUrl,
};
