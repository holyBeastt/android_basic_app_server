// controllers/instructor_controllers/sectionController.js
import SectionService from "../../services/SectionService.js";
import supabase from "../../config/supabase.js";

const list = async (req, res) => {
  try {
    const instructorId = req.user?.id || req.params.instructorId;
    const { course_id, _start, _end, _page, _limit, _sort, _order } = req.query;
    
    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!course_id) {
      return res.status(400).json({ error: "course_id parameter is required" });
    }

    // Verify course ownership
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id")
      .eq("id", course_id)
      .eq("user_id", instructorId)
      .single();

    if (courseError || !course) {
      return res.status(404).json({ error: "Course not found or access denied" });
    }

    // Build query
    let query = supabase
      .from("sections")
      .select("*", { count: "exact" })
      .eq("course_id", course_id);

    // Sorting
    if (_sort && ['title', 'order_index', 'created_at'].includes(_sort)) {
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
      throw new Error(`Error fetching sections: ${error.message}`);
    }

    // React-Admin headers
    res.set('X-Total-Count', count.toString());
    res.set('Access-Control-Expose-Headers', 'X-Total-Count');
    
    return res.status(200).json({ data: data || [], total: count || 0 });
  } catch (error) {
    console.error("SectionController.list error:", error);
    return res.status(500).json({ error: error.message });
  }
};

const getOne = async (req, res) => {
  try {
    const instructorId = req.user?.id || req.params.instructorId;
    const { sectionId } = req.params;
    
    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // First get the section
    const { data: section, error: sectionError } = await supabase
      .from("sections")
      .select("*")
      .eq("id", sectionId)
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

    return res.status(200).json({ data: section });
  } catch (error) {
    console.error("SectionController.getOne error:", error);
    return res.status(500).json({ error: error.message });
  }
};

const create = async (req, res) => {
  try {
    const instructorId = req.user?.id || req.params.instructorId;
    const { courseId } = req.params;
    
    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const sectionData = req.body;

    // Validate required fields
    if (!sectionData.title) {
      return res.status(400).json({ 
        error: "Thiếu thông tin bắt buộc: title" 
      });
    }

    const result = await SectionService.create(courseId, instructorId, sectionData);
    return res.status(201).json(result);
  } catch (error) {
    console.error("SectionController.create error:", error);
    if (error.message.includes("Không tìm thấy")) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || "Đã xảy ra lỗi máy chủ" });
  }
};

const update = async (req, res) => {
  try {
    const instructorId = req.user?.id || req.params.instructorId;
    const { sectionId } = req.params;
    const updateData = req.body;
    
    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.course_id;
    delete updateData.created_at;

    const result = await SectionService.update(sectionId, instructorId, updateData);
    return res.status(200).json(result);
  } catch (error) {
    console.error("SectionController.update error:", error);
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
    const { sectionId } = req.params;
    
    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await SectionService.delete(sectionId, instructorId);
    return res.status(204).send();
  } catch (error) {
    console.error("SectionController.remove error:", error);
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
