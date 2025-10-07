// services/QuestionService.js
import supabase from "../config/supabase.js";

class QuestionService {
  async create(quizId, instructorId, questionData) {
    try {
      console.log("📝 QuestionService.create - Bắt đầu tạo question");
      console.log("🧩 Quiz ID:", quizId);
      console.log("👤 Instructor ID:", instructorId);
      console.log("❓ Question Data:", JSON.stringify(questionData, null, 2));
      
      // Simple verification: check quiz exists and belongs to instructor
      console.log("🔍 Kiểm tra quiz tồn tại...");
      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .select("id, lesson_id")
        .eq("id", quizId)
        .single();

      if (quizError) {
        console.log("❌ Lỗi khi query quiz:", quizError);
        throw new Error("Không tìm thấy quiz");
      }
      
      if (!quiz) {
        console.log("❌ Quiz không tồn tại");
        throw new Error("Không tìm thấy quiz");
      }
      
      console.log("✅ Quiz tồn tại:", quiz);

      // Check lesson and course ownership
      console.log("🔍 Kiểm tra lesson của quiz...");
      const { data: lesson, error: lessonError } = await supabase
        .from("lessons")
        .select("id, course_id")
        .eq("id", quiz.lesson_id)
        .single();

      if (lessonError) {
        console.log("❌ Lỗi khi query lesson:", lessonError);
        throw new Error("Không tìm thấy lesson");
      }
      
      if (!lesson) {
        console.log("❌ Lesson không tồn tại");
        throw new Error("Không tìm thấy lesson");
      }
      
      console.log("✅ Lesson tồn tại:", lesson);

      console.log("🔍 Kiểm tra quyền truy cập course...");
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("id")
        .eq("id", lesson.course_id)
        .eq("user_id", instructorId)
        .single();

      if (courseError) {
        console.log("❌ Lỗi khi query course:", courseError);
        throw new Error("Bạn không có quyền truy cập quiz này");
      }
      
      if (!course) {
        console.log("❌ Course không thuộc về instructor này");
        throw new Error("Bạn không có quyền truy cập quiz này");
      }
      
      console.log("✅ Instructor có quyền truy cập course:", course);

      console.log("💾 Tạo question trong database...");
      
      // Helper function to clean undefined values
      const cleanObject = (obj) => {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
          if (value !== undefined) {
            cleaned[key] = value;
          }
        }
        return cleaned;
      };
      
      const questionToCreate = cleanObject({
        question_text: questionData.question_text,
        options: questionData.options,
        correct_option: questionData.correct_option || questionData.correct_answer,
        explanation: questionData.explanation,
        order_index: questionData.order_index || 0,
        quiz_id: quizId
      });
      
      console.log("📋 Question object to create:", questionToCreate);
      console.log("🔍 Debug correct_option:", {
        from_request: questionData.correct_option,
        from_correct_answer: questionData.correct_answer,
        final_value: questionToCreate.correct_option
      });
      
      const { data: question, error } = await supabase
        .from("quiz_questions")
        .insert([questionToCreate])
        .select()
        .single();

      if (error) {
        console.log("❌ Lỗi khi insert question:", error);
        throw new Error(`Lỗi khi tạo question: ${error.message}`);
      }

      console.log("🎉 Question được tạo thành công:", question);
      return { data: question };
    } catch (error) {
      console.error("❌ QuestionService.create error:", error);
      console.error("📍 Error stack:", error.stack);
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
