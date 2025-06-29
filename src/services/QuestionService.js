// services/QuestionService.js
import supabase from "../config/supabase.js";

class QuestionService {
  async create(quizId, instructorId, questionData) {
    try {
      // Simple verification: check quiz exists and belongs to instructor
      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .select("id, lesson_id")
        .eq("id", quizId)
        .single();

      if (quizError || !quiz) {
        throw new Error("Không tìm thấy quiz");
      }

      // Check lesson and course ownership
      const { data: lesson, error: lessonError } = await supabase
        .from("lessons")
        .select("id, course_id")
        .eq("id", quiz.lesson_id)
        .single();

      if (lessonError || !lesson) {
        throw new Error("Không tìm thấy lesson");
      }

      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("id")
        .eq("id", lesson.course_id)
        .eq("user_id", instructorId)
        .single();

      if (courseError || !course) {
        throw new Error("Bạn không có quyền truy cập quiz này");
      }

      const { data: question, error } = await supabase
        .from("quiz_questions")
        .insert([{
          question_text: questionData.question_text,
          options: questionData.options,
          correct_option: questionData.correct_option,
          explanation: questionData.explanation,
          order_index: questionData.order_index,
          quiz_id: quizId
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Lỗi khi tạo question: ${error.message}`);
      }

      return { data: question };
    } catch (error) {
      console.error("QuestionService.create error:", error);
      throw error;
    }
  }

  async update(questionId, instructorId, updateData) {
    try {
      // 1. Verify ownership qua quiz -> lesson -> section -> course -> user_id
      const { data: quiz, error: checkError } = await supabase
        .from("quizzes")
        .select(`
        id,
        lesson_id,
        lessons!inner (
          section_id,
          sections!inner (
            course_id,
            courses!inner ( user_id )
          )
        )
      `)
        .eq("id", updateData.quiz_id)                       // quiz_id của câu hỏi
        .eq("lessons.sections.courses.user_id", instructorId)
        .single();

      if (checkError || !quiz) {
        throw new Error("Không tìm thấy quiz hoặc bạn không có quyền sửa");
      }

      // 2. Thực thi update trên bảng con quiz_questions
      const { data: updatedQuestion, error } = await supabase
        .from("quiz_questions")                             // ← chỉ thay bảng ở đây
        .update(updateData)
        .eq("id", questionId)                               // ← filter đúng questionId
        .select()
        .single();

      if (error) {
        throw new Error(`Lỗi khi cập nhật câu hỏi: ${error.message}`);
      }

      return { data: updatedQuestion };
    } catch (error) {
      console.error("QuestionService.update error:", error);
      throw error;
    }
  }
  
  async delete(questionId, instructorId) {
    try {
      // Simple check: verify question exists and belongs to instructor's course
      const { data: question, error: checkError } = await supabase
        .from("quiz_questions")
        .select("id, quiz_id")
        .eq("id", questionId)
        .single();

      if (checkError || !question) {
        throw new Error("Không tìm thấy question");
      }

      // Check quiz, lesson and course ownership
      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .select("id, lesson_id")
        .eq("id", question.quiz_id)
        .single();

      if (quizError || !quiz) {
        throw new Error("Không tìm thấy quiz");
      }

      const { data: lesson, error: lessonError } = await supabase
        .from("lessons")
        .select("id, course_id")
        .eq("id", quiz.lesson_id)
        .single();

      if (lessonError || !lesson) {
        throw new Error("Không tìm thấy lesson");
      }

      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("id")
        .eq("id", lesson.course_id)
        .eq("user_id", instructorId)
        .single();

      if (courseError || !course) {
        throw new Error("Bạn không có quyền xóa question này");
      }

      const { error: deleteError } = await supabase
        .from("quiz_questions")
        .delete()
        .eq("id", questionId);

      if (deleteError) {
        throw new Error(`Lỗi khi xóa question: ${deleteError.message}`);
      }

      return { message: "Question đã được xóa thành công" };
    } catch (error) {
      console.error("QuestionService.delete error:", error);
      throw error;
    }
  }
}

export default new QuestionService();
