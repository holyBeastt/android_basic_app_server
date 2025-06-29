// controllers/instructor_controllers/quizController.js
import QuizService from "../../services/QuizService.js";
import supabase from "../../config/supabase.js";

const list = async (req, res) => {
  try {
    const instructorId = req.user?.id || req.params.instructorId;
    const { lesson_id, _start, _end, _page, _limit, _sort, _order } = req.query;
    
    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!lesson_id) {
      return res.status(400).json({ error: "lesson_id parameter is required" });
    }

    // Verify lesson ownership through section->course
    const { data: lesson, error: lessonError } = await supabase
      .from("lessons")
      .select(`
        id,
        sections!inner (
          id,
          courses!inner (
            id,
            user_id
          )
        )
      `)
      .eq("id", lesson_id)
      .eq("sections.courses.user_id", instructorId)
      .single();

    if (lessonError || !lesson) {
      return res.status(404).json({ error: "Lesson not found or access denied" });
    }

    // Build query
    let query = supabase
      .from("quizzes")
      .select("*", { count: "exact" })
      .eq("lesson_id", lesson_id);

    // Sorting
    if (_sort && ['title', 'created_at'].includes(_sort)) {
      query = query.order(_sort, { ascending: _order !== 'DESC' });
    } else {
      query = query.order("created_at", { ascending: false });
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
      throw new Error(`Error fetching quizzes: ${error.message}`);
    }

    // React-Admin headers
    res.set('X-Total-Count', count.toString());
    res.set('Access-Control-Expose-Headers', 'X-Total-Count');
    
    return res.status(200).json({ data: data || [], total: count || 0 });
  } catch (error) {
    console.error("QuizController.list error:", error);
    return res.status(500).json({ error: error.message });
  }
};

const getOne = async (req, res) => {
  try {
    const instructorId = req.user?.id || req.params.instructorId;
    const { quizId } = req.params;
    
    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get quiz with ownership verification
    const { data: quiz, error } = await supabase
      .from("quizzes")
      .select(`
        *,
        lessons!inner (
          id,
          sections!inner (
            id,
            courses!inner (
              id,
              user_id
            )
          )
        )
      `)
      .eq("id", quizId)
      .eq("lessons.sections.courses.user_id", instructorId)
      .single();

    if (error || !quiz) {
      return res.status(404).json({ error: "Quiz not found or access denied" });
    }

    // Remove nested data for clean response
    delete quiz.lessons;

    return res.status(200).json({ data: quiz });
  } catch (error) {
    console.error("QuizController.getOne error:", error);
    return res.status(500).json({ error: error.message });
  }
};

const create = async (req, res) => {
  try {
    const instructorId = req.user?.id || req.params.instructorId;
    const { lessonId } = req.params;
    
    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const quizData = req.body;

    // Validate required fields
    if (!quizData.title) {
      return res.status(400).json({ 
        error: "Thiếu thông tin bắt buộc: title" 
      });
    }

    const result = await QuizService.create(lessonId, instructorId, quizData);
    return res.status(201).json(result);
  } catch (error) {
    console.error("QuizController.create error:", error);
    if (error.message.includes("Không tìm thấy")) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || "Đã xảy ra lỗi máy chủ" });
  }
};

const update = async (req, res) => {
  try {
    const instructorId = req.user?.id || req.params.instructorId;
    const { quizId } = req.params;
    const updateData = req.body;
    
    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log("Update data received:", updateData);

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.lesson_id;
    delete updateData.created_at;

    const result = await QuizService.update(quizId, updateData, instructorId);
    return res.status(200).json(result);
  } catch (error) {
    console.error("QuizController.update error:", error);
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
    const { quizId } = req.params;
    
    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await QuizService.delete(quizId, instructorId);
    return res.status(204).send();
  } catch (error) {
    console.error("QuizController.remove error:", error);
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
