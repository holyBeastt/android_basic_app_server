// controllers/instructor_controllers/lessonController.js
import LessonService from "../../services/LessonService.js";
import supabase from "../../config/supabase.js";
import multer from "multer";
import path from "path";

const list = async (req, res) => {
  try {
    const instructorId = req.user?.id || req.params.instructorId;
    const { section_id, _start, _end, _page, _limit, _sort, _order } = req.query;
    
    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!section_id) {
      return res.status(400).json({ error: "section_id parameter is required" });
    }

    // First get the section
    const { data: section, error: sectionError } = await supabase
      .from("sections")
      .select("*")
      .eq("id", section_id)
      .single();

    if (sectionError || !section) {
      return res.status(404).json({ error: "Section not found" });
    }

    // Then verify course ownership
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id")
      .eq("id", section.course_id)
      .eq("user_id", instructorId)
      .single();

    if (courseError || !course) {
      return res.status(404).json({ error: "Access denied" });
    }

    // Build query
    let query = supabase
      .from("lessons")
      .select("*", { count: "exact" })
      .eq("section_id", section_id);

    // Sorting
    if (_sort && ['title', 'order_index', 'created_at', 'duration'].includes(_sort)) {
      query = query.order(_sort, { ascending: _order !== 'DESC' });
    } else {
      query = query.order("order_index");
    }

    // Pagination
    if (_page && _limit) {
      const offset = (parseInt(_page) - 1) * parseInt(_limit);
      query = query.range(offset, offset + parseInt(_limit) - 1);
    } else if (_start && _end) {
      query = query.range(parseInt(_start), parseInt(_end) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Error fetching lessons: ${error.message}`);
    }

    // React-Admin headers
    res.set('X-Total-Count', count.toString());
    res.set('Access-Control-Expose-Headers', 'X-Total-Count');
    
    return res.status(200).json({ data: data || [], total: count || 0 });
  } catch (error) {
    console.error("LessonController.list error:", error);
    return res.status(500).json({ error: error.message });
  }
};

const getOne = async (req, res) => {
  try {
    const instructorId = req.user?.id || req.params.instructorId;
    const { lessonId } = req.params;
    
    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get lesson with ownership verification through section->course
    const { data: lesson, error } = await supabase
      .from("lessons")
      .select(`
        *,
        sections!inner (
          id,
          courses!inner (
            id,
            user_id
          )
        )
      `)
      .eq("id", lessonId)
      .eq("sections.courses.user_id", instructorId)
      .single();

    if (error || !lesson) {
      return res.status(404).json({ error: "Lesson not found or access denied" });
    }

    // Remove nested data for clean response
    delete lesson.sections;

    return res.status(200).json({ data: lesson });
  } catch (error) {
    console.error("LessonController.getOne error:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Multer setup for video upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed!"));
    }
  },
});

// Helper to upload video to Supabase Storage
async function uploadVideoToSupabase(file, instructorId) {
  if (!file) return null;
  const ext = path.extname(file.originalname);
  const fileName = `lesson_videos/${instructorId}_${Date.now()}${ext}`;
  const { data, error } = await supabase.storage
    .from("videos")
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });
  if (error) throw new Error("Lỗi upload video: " + error.message);
  // Get public URL
  const { data: publicUrlData } = supabase.storage.from("videos").getPublicUrl(fileName);
  return publicUrlData?.publicUrl || null;
}

// Wrap create with multer middleware
const create = [
  upload.single("video"),
  async (req, res) => {
    try {
      console.log("[LessonController.create] req.file:", req.file);
      const instructorId = req.user?.id || req.params.instructorId;
      const { sectionId } = req.params;
      if (!instructorId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const lessonData = req.body;
      // Validate required fields
      if (!lessonData.title) {
        return res.status(400).json({ error: "Thiếu thông tin bắt buộc: title" });
      }
      // Handle video upload
      if (req.file) {
        const videoUrl = await uploadVideoToSupabase(req.file, instructorId);
        console.log("[LessonController.create] videoUrl:", videoUrl);
        lessonData.video_url = videoUrl;
      }
      const result = await LessonService.create(sectionId, instructorId, lessonData);
      return res.status(201).json(result);
    } catch (error) {
      console.error("LessonController.create error:", error);
      if (error.message.includes("Không tìm thấy")) {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || "Đã xảy ra lỗi máy chủ" });
    }
  }
];

// Wrap update with multer middleware
const update = [
  upload.single("video"),
  async (req, res) => {
    try {
      console.log("[LessonController.update] req.file:", req.file);
      const instructorId = req.user?.id || req.params.instructorId;
      const { lessonId } = req.params;
      const updateData = req.body;
      if (!instructorId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      // Remove fields that shouldn't be updated directly
      delete updateData.id;
      delete updateData.section_id;
      delete updateData.created_at;
      // Handle video upload
      if (req.file) {
        const videoUrl = await uploadVideoToSupabase(req.file, instructorId);
        console.log("[LessonController.update] videoUrl:", videoUrl);
        updateData.content_url = videoUrl;
        // Không gán updateData.video_url nữa
      }
      const result = await LessonService.update(lessonId, instructorId, updateData);
      return res.status(200).json(result);
    } catch (error) {
      console.error("LessonController.update error:", error);
      if (error.message.includes("Không tìm thấy")) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes("không có quyền")) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || "Đã xảy ra lỗi máy chủ" });
    }
  }
];

const remove = async (req, res) => {
  try {
    const instructorId = req.user?.id || req.params.instructorId;
    const { lessonId } = req.params;
    
    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await LessonService.delete(lessonId, instructorId);
    return res.status(204).send();
  } catch (error) {
    console.error("LessonController.remove error:", error);
    if (error.message.includes("Không tìm thấy")) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || "Đã xảy ra lỗi máy chủ" });
  }
};

export default {
  list,
  getOne,
  create, // now is an array with multer middleware
  update, // now is an array with multer middleware
  remove
};
