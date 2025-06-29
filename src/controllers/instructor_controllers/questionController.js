// controllers/instructor_controllers/questionController.js
import QuestionService from "../../services/QuestionService.js";
import supabase from "../../config/supabase.js";

const list = async (req, res) => {
  try {
    const instructorId = req.user?.id || req.params.instructorId;
    const { quiz_id, _start, _end, _page, _limit, _sort, _order } = req.query;
    
    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!quiz_id) {
      return res.status(400).json({ error: "quiz_id parameter is required" });
    }

    // Verify quiz ownership through lesson->section->course
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select(`
        id,
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
      .eq("id", quiz_id)
      .eq("lessons.sections.courses.user_id", instructorId)
      .single();

    if (quizError || !quiz) {
      return res.status(404).json({ error: "Quiz not found or access denied" });
    }

    // Build query
    let query = supabase
      .from("quiz_questions")
      .select("*", { count: "exact" })
      .eq("quiz_id", quiz_id);

    // Sorting
    if (_sort && ['question_text', 'order_index', 'created_at'].includes(_sort)) {
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
      throw new Error(`Error fetching questions: ${error.message}`);
    }

    // React-Admin headers
    res.set('X-Total-Count', count.toString());
    res.set('Access-Control-Expose-Headers', 'X-Total-Count');
    
    return res.status(200).json({ data: data || [], total: count || 0 });
  } catch (error) {
    console.error("QuestionController.list error:", error);
    return res.status(500).json({ error: error.message });
  }
};

const getOne = async (req, res) => {
  try {
    const instructorId = req.user?.id || req.params.instructorId;
    const { questionId } = req.params;
    
    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get question with ownership verification
    const { data: question, error } = await supabase
      .from("quiz_questions")
      .select(`
        *,
        quizzes!inner (
          id,
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
        )
      `)
      .eq("id", questionId)
      .eq("quizzes.lessons.sections.courses.user_id", instructorId)
      .single();

    if (error || !question) {
      return res.status(404).json({ error: "Question not found or access denied" });
    }

    // Remove nested data for clean response
    delete question.quizzes;

    return res.status(200).json({ data: question });
  } catch (error) {
    console.error("QuestionController.getOne error:", error);
    return res.status(500).json({ error: error.message });
  }
};

const create = async (req, res) => {
  try {
    const instructorId = req.user?.id || req.params.instructorId;
    const { quizId } = req.params;
    
    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const questionData = req.body;

    // Validate required fields
    if (!questionData.question_text) {
      return res.status(400).json({ 
        error: "Thiếu thông tin bắt buộc: question_text" 
      });
    }

    const result = await QuestionService.create(quizId, instructorId, questionData);
    return res.status(201).json(result);
  } catch (error) {
    console.error("QuestionController.create error:", error);
    if (error.message.includes("Không tìm thấy")) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || "Đã xảy ra lỗi máy chủ" });
  }
};

const update = async (req, res) => {
  try {
    const instructorId = req.user?.id || req.params.instructorId;
    const { questionId } = req.params;
    const updateData = req.body;
    
    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.quiz_id;
    delete updateData.created_at;

    const result = await QuestionService.update(questionId, instructorId, updateData);
    return res.status(200).json(result);
  } catch (error) {
    console.error("QuestionController.update error:", error);
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
    const { questionId } = req.params;
    
    if (!instructorId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await QuestionService.delete(questionId, instructorId);
    return res.status(204).send();
  } catch (error) {
    console.error("QuestionController.remove error:", error);
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
