// services/QuizService.js
import supabase from "../config/supabase.js";
import QuestionService from "./QuestionService.js"; // Assuming you have a QuestionService for handling questions

class QuizService {
  async create(lessonId, instructorId, quizData) {
    try {
      // Simple verification: check lesson exists and belongs to instructor
      const { data: lesson, error: lessonError } = await supabase
        .from("lessons")
        .select("id, section_id, course_id")
        .eq("id", lessonId)
        .single();

      if (lessonError || !lesson) {
        throw new Error("Không tìm thấy lesson");
      }

      // Check if course belongs to instructor
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("id")
        .eq("id", lesson.course_id)
        .eq("user_id", instructorId)
        .single();

      if (courseError || !course) {
        throw new Error("Bạn không có quyền truy cập lesson này");
      }

      const { data: quiz, error } = await supabase
        .from("quizzes")
        .insert([{
          title: quizData.title,
          description: quizData.description,
          lesson_id: lessonId
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Lỗi khi tạo quiz: ${error.message}`);
      }

      return { data: quiz };
    } catch (error) {
      console.error("QuizService.create error:", error);
      throw error;
    }
  }

  async update(quizId, updateData, instructorId) {
    console.log("QuizService.update called with:", { quizId, updateData, instructorId });
    try {
      // 1. Tách questions ra, chỉ giữ lại các field thuộc quizzes
      const { questions, ...quizFields } = updateData;

      // 2. Update bảng quizzes (không bao gồm key 'questions')
      const { data: quiz, error } = await supabase
        .from("quizzes")         // hoặc "quizz" nếu table bạn đặt tên thế
        .update(quizFields)
        .eq("id", quizId)
        .select()
        .single();

      if (error) {
        throw new Error(`Lỗi khi cập nhật quiz: ${error.message}`);
      }
      if (!quiz) {
        throw new Error("Không tìm thấy quiz");
      }

      // 3. Nếu có mảng questions, xử lý từng câu hỏi
      if (Array.isArray(questions)) {
        for (const q of questions) {
          if (q.id) {
            // đã có id thì update
            await QuestionService.update(q.id, instructorId, {
              question_text: q.question_text,
              options: q.options,
              correct_option: q.correct_option,
              explanation: q.explanation,
              order_index: q.order_index,
              quiz_id: quizId
            });
          } else {
            // chưa có id thì tạo mới
            await QuestionService.create(quizId, instructorId, {
              question_text: q.question_text,
              options: q.options,
              correct_option: q.correct_option,
              explanation: q.explanation,
              order_index: q.order_index
            });
          }
        }
      }

      return { data: quiz };
    } catch (error) {
      console.error("QuizService.update error:", error);
      throw error;
    }
  }


  async delete(quizId, instructorId) {
    try {
      // Simple check: verify quiz exists and belongs to instructor's course
      const { data: quiz, error: checkError } = await supabase
        .from("quizzes")
        .select("id, lesson_id")
        .eq("id", quizId)
        .single();

      if (checkError || !quiz) {
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
        throw new Error("Bạn không có quyền xóa quiz này");
      }

      const { error: deleteError } = await supabase
        .from("quizzes")
        .delete()
        .eq("id", quizId);

      if (deleteError) {
        throw new Error(`Lỗi khi xóa quiz: ${deleteError.message}`);
      }

      return { message: "Quiz đã được xóa thành công" };
    } catch (error) {
      console.error("QuizService.delete error:", error);
      throw error;
    }
  }
}

export default new QuizService();
