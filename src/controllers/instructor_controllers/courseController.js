// controllers/instructor_controllers/courseController.js
import CourseService from "../../services/CourseService.js";

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

const create = async (req, res) => {
  try {
    const instructorId = req.user?.id || req.params.instructorId;
    
    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const courseData = req.body;

    // Validate required fields
    if (!courseData.title || !courseData.description) {
      return res.status(400).json({ 
        error: "Thiếu thông tin bắt buộc: title, description" 
      });
    }

    // Only create basic course data - other content will be added via update API
    // This ensures clean separation: CREATE for course, UPDATE for sections/lessons/quizzes
    const result = await CourseService.createSimple(instructorId, courseData);
    return res.status(201).json(result);
  } catch (error) {
    console.error("CourseController.create error:", error);
    return res.status(500).json({ error: error.message || "Đã xảy ra lỗi máy chủ" });
  }
};

const update = async (req, res) => {
  try {
    const instructorId = req.user?.id || req.params.instructorId;
    const { courseId } = req.params;
    
    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const updateData = req.body;
    
    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.user_id;
    delete updateData.created_at;

    const result = await CourseService.updateNested(courseId, instructorId, updateData);
    return res.status(200).json(result);
  } catch (error) {
    console.error("CourseController.update error:", error);
    if (error.message.includes("Không tìm thấy")) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || "Đã xảy ra lỗi máy chủ" });
  }
};

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

export default {
  list,
  getOne,
  create,
  update,
  remove
};
