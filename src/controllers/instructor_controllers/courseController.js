// controllers/instructor_controllers/courseController.js
import CourseService from "../../services/CourseService.js";
import supabase from "../../config/supabase.js";
import multer from "multer";
import path from "path";

const list = async (req, res) => {
  try {
    const instructorId = req.user?.id || req.params.instructorId;
    
    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Support both current params and react-admin params
    const { 
      limit, offset, search,           // Current params
      _start, _end, _page, _limit,     // React-Admin params
      _sort, _order, q                 // React-Admin sorting & search
    } = req.query;

    // Convert react-admin pagination to our format
    let options = {
      limit: 10,
      offset: 0,
      search: search || q || ""
    };

    // Handle different pagination styles
    if (_page && _limit) {
      options.limit = parseInt(_limit);
      options.offset = (parseInt(_page) - 1) * parseInt(_limit);
    } else if (_start && _end) {
      options.limit = parseInt(_end) - parseInt(_start);
      options.offset = parseInt(_start);
    } else if (limit) {
      options.limit = parseInt(limit);
      options.offset = parseInt(offset) || 0;
    }

    // Handle sorting
    if (_sort) {
      options.sortBy = _sort;
      options.sortOrder = _order === 'DESC' ? 'desc' : 'asc';
    }

    const result = await CourseService.list(instructorId, options);
    
    // 🔥 CRITICAL: Add X-Total-Count header for React-Admin
    res.set('X-Total-Count', result.total.toString());
    res.set('Access-Control-Expose-Headers', 'X-Total-Count');
    
    return res.status(200).json(result);
  } catch (error) {
    console.error("CourseController.list error:", error);
    return res.status(500).json({ error: error.message || "Đã xảy ra lỗi máy chủ" });
  }
};

const getOne = async (req, res) => {
  try {
    const instructorId = req.user?.id || req.params.instructorId;
    const { courseId } = req.params;

    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await CourseService.getOne(courseId, instructorId);
    return res.status(200).json(result);
  } catch (error) {
    console.error("CourseController.getOne error:", error);
    if (error.message.includes("Không tìm thấy")) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || "Đã xảy ra lỗi máy chủ" });
  }
};

// Multer setup for image & video upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only image and video files are allowed!"));
    }
  },
});

// Helper to upload file to Supabase Storage
async function uploadFileToSupabase(file, instructorId, type = "other") {
  if (!file) return null;
  const ext = path.extname(file.originalname);
  let folder =
    type === "image"
      ? "course_thumbnails"
      : type === "video"
      ? "course_demo_videos"
      : type === "preview"
      ? "course_preview_videos"
      : "other";
  const fileName = `${folder}/${instructorId}_${Date.now()}${ext}`;
  const { data, error } = await supabase.storage
    .from("images") // đổi từ 'media' sang 'images'
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });
  if (error) throw new Error("Lỗi upload file: " + error.message);
  const { data: publicUrlData } = supabase.storage.from("images").getPublicUrl(fileName);
  return publicUrlData?.publicUrl || null;
}

// Wrap create with multer middleware
const create = [
  upload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "demo_video", maxCount: 1 },
    { name: "preview_video", maxCount: 1 },
    { name: "image", maxCount: 1 }, // thêm image nếu cần
    { name: "video", maxCount: 1 }, // thêm video nếu cần
  ]),
  async (req, res) => {
    try {
      const instructorId = req.user?.id || req.params.instructorId;
      if (!instructorId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const courseData = req.body;
      // Validate required fields
      if (!courseData.title || !courseData.description) {
        return res.status(400).json({ error: "Thiếu thông tin bắt buộc: title, description" });
      }
      // Handle thumbnail upload
      if (req.files && req.files.thumbnail && req.files.thumbnail[0]) {
        const url = await uploadFileToSupabase(req.files.thumbnail[0], instructorId, "image");
        courseData.thumbnail_url = url;
      }
      // Handle image upload (alternative to thumbnail)
      if (req.files && req.files.image && req.files.image[0]) {
        const url = await uploadFileToSupabase(req.files.image[0], instructorId, "image");
        courseData.thumbnail_url = url;
      }
      // Handle demo video upload
      if (req.files && req.files.demo_video && req.files.demo_video[0]) {
        const url = await uploadFileToSupabase(req.files.demo_video[0], instructorId, "video");
        courseData.demo_video_url = url;
      }
      // Handle video upload (alternative to demo_video)
      if (req.files && req.files.video && req.files.video[0]) {
        const url = await uploadFileToSupabase(req.files.video[0], instructorId, "video");
        courseData.demo_video_url = url;
      }
      // Handle preview video upload
      if (req.files && req.files.preview_video && req.files.preview_video[0]) {
        const url = await uploadFileToSupabase(req.files.preview_video[0], instructorId, "preview");
        courseData.preview_video_url = url;
      }

      // Validate và sync data với Supabase fields
      if (courseData.level) {
        courseData.level = courseData.level.toLowerCase();
      }

      // Convert arrays to strings if needed
      if (Array.isArray(courseData.requirements)) {
        courseData.requirements = courseData.requirements.join('\\n');
      }
      if (Array.isArray(courseData.what_you_learn)) {
        courseData.what_you_learn = courseData.what_you_learn.join('\\n');
      }
      const result = await CourseService.createSimple(instructorId, courseData);
      return res.status(201).json(result);
    } catch (error) {
      console.error("CourseController.create error:", error);
      return res.status(500).json({ error: error.message || "Đã xảy ra lỗi máy chủ" });
    }
  }
];

// Wrap update with multer middleware
const update = [
  upload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "demo_video", maxCount: 1 },
    { name: "preview_video", maxCount: 1 },
    { name: "image", maxCount: 1 }, // thêm image nếu cần
    { name: "video", maxCount: 1 }, // thêm video nếu cần
  ]),
  async (req, res) => {
    try {
      const instructorId = req.user?.id || req.params.instructorId;
      const { courseId } = req.params;
      if (!instructorId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const updateData = req.body;
      delete updateData.id;
      delete updateData.user_id;
      delete updateData.created_at;
      
      // Handle thumbnail upload
      if (req.files && req.files.thumbnail && req.files.thumbnail[0]) {
        const url = await uploadFileToSupabase(req.files.thumbnail[0], instructorId, "image");
        updateData.thumbnail_url = url;
      }
      // Handle image upload (alternative to thumbnail)
      if (req.files && req.files.image && req.files.image[0]) {
        const url = await uploadFileToSupabase(req.files.image[0], instructorId, "image");
        updateData.thumbnail_url = url;
      }
      // Handle demo video upload
      if (req.files && req.files.demo_video && req.files.demo_video[0]) {
        const url = await uploadFileToSupabase(req.files.demo_video[0], instructorId, "video");
        updateData.demo_video_url = url;
      }
      // Handle video upload (alternative to demo_video)
      if (req.files && req.files.video && req.files.video[0]) {
        const url = await uploadFileToSupabase(req.files.video[0], instructorId, "video");
        updateData.demo_video_url = url;
      }
      // Handle preview video upload
      if (req.files && req.files.preview_video && req.files.preview_video[0]) {
        const url = await uploadFileToSupabase(req.files.preview_video[0], instructorId, "preview");
        updateData.preview_video_url = url;
      }

      // Validate và sync data với Supabase fields
      if (updateData.level) {
        updateData.level = updateData.level.toLowerCase();
      }

      // Convert arrays to strings if needed
      if (Array.isArray(updateData.requirements)) {
        updateData.requirements = updateData.requirements.join('\\n');
      }
      if (Array.isArray(updateData.what_you_learn)) {
        updateData.what_you_learn = updateData.what_you_learn.join('\\n');
      }
      const result = await CourseService.updateNested(courseId, instructorId, updateData);
      return res.status(200).json(result);
    } catch (error) {
      console.error("CourseController.update error:", error);
      if (error.message.includes("Không tìm thấy")) {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || "Đã xảy ra lỗi máy chủ" });
    }
  }
];

const remove = async (req, res) => {
  try {
    const instructorId = req.user?.id || req.params.instructorId;
    const { courseId } = req.params;
    
    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await CourseService.delete(courseId, instructorId);
    return res.status(204).send();
  } catch (error) {
    console.error("CourseController.remove error:", error);
    if (error.message.includes("Không tìm thấy")) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || "Đã xảy ra lỗi máy chủ" });
  }
};

const getRevenueStats = async (req, res) => {
  try {
    const instructorId = req.user?.id || req.params.instructorId;
    
    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await CourseService.getRevenueStats(instructorId);
    return res.status(200).json(result);
  } catch (error) {
    console.error("CourseController.getRevenueStats error:", error);
    return res.status(500).json({ error: error.message || "Đã xảy ra lỗi máy chủ" });
  }
};

export default {
  list,
  getOne,
  create, // now is an array with multer middleware
  update, // now is an array with multer middleware
  remove,
  getRevenueStats
};
