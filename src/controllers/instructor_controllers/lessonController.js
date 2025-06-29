// controllers/instructor_controllers/lessonController.js
import LessonService from "../../services/LessonService.js";
import supabase from "../../config/supabase.js";

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

const create = async (req, res) => {
  try {
    const instructorId = req.user?.id || req.params.instructorId;
    const { sectionId } = req.params;
    
    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const lessonData = req.body;

    // Validate required fields
    if (!lessonData.title) {
      return res.status(400).json({ 
        error: "Thiếu thông tin bắt buộc: title" 
      });
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
};

const update = async (req, res) => {
  try {
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
};

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
  list,        // 🆕 New method
  getOne,      // 🆕 New method
  create,
  update,
  remove
};
