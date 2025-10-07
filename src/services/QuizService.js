// services/QuizService.js
import supabase from "../config/supabase.js";
import QuestionService from "./QuestionService.js"; // Assuming you have a QuestionService for handling questions

class QuizService {
  async create(lessonId, instructorId, quizData) {
    try {
      console.log("🔄 QuizService.create - Bắt đầu tạo quiz trong service");
      console.log("📚 Lesson ID:", lessonId);
      console.log("👤 Instructor ID:", instructorId);
      console.log("📝 Quiz Data:", JSON.stringify(quizData, null, 2));
      
      // Simple verification: check lesson exists and belongs to instructor
      console.log("🔍 Kiểm tra lesson tồn tại...");
      const { data: lesson, error: lessonError } = await supabase
        .from("lessons")
        .select("id, section_id, course_id")
        .eq("id", lessonId)
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

      // Check if course belongs to instructor
      console.log("🔍 Kiểm tra quyền truy cập course...");
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("id")
        .eq("id", lesson.course_id)
        .eq("user_id", instructorId)
        .single();

      if (courseError) {
        console.log("❌ Lỗi khi query course:", courseError);
        throw new Error("Bạn không có quyền truy cập lesson này");
      }
      
      if (!course) {
        console.log("❌ Course không thuộc về instructor này");
        throw new Error("Bạn không có quyền truy cập lesson này");
      }
      
      console.log("✅ Instructor có quyền truy cập course:", course);

      console.log("💾 Tạo quiz trong database...");
      const { questions, ...quizFields } = quizData; // Tách questions ra
      
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
      
      const quizToCreate = cleanObject({
        title: quizFields.title,
        description: quizFields.description,
        lesson_id: lessonId
      });
      
      console.log("📋 Quiz object to create:", quizToCreate);
      console.log("🔍 Debug quiz fields:", {
        original_description: quizFields.description,
        final_description: quizToCreate.description
      });
      
      const { data: quiz, error } = await supabase
        .from("quizzes")
        .insert([quizToCreate])
        .select()
        .single();

      if (error) {
        console.log("❌ Lỗi khi insert quiz:", error);
        throw new Error(`Lỗi khi tạo quiz: ${error.message}`);
      }

      console.log("🎉 Quiz được tạo thành công:", quiz);
      
      // Tạo questions nếu có
      if (Array.isArray(questions) && questions.length > 0) {
        console.log(`📝 Tạo ${questions.length} questions cho quiz...`);
        
        for (let i = 0; i < questions.length; i++) {
          const question = questions[i];
          console.log(`🔄 Tạo question ${i + 1}/${questions.length}:`, question.question_text);
          
          try {
            await QuestionService.create(quiz.id, instructorId, {
              question_text: question.question_text,
              question_type: question.question_type || null,
              correct_option: question.correct_option || question.correct_answer || null, // Fix field mapping
              options: question.options,
              explanation: question.explanation || null,
              order_index: question.order_index || i
            });
            console.log(`✅ Question ${i + 1} created successfully`);
          } catch (questionError) {
            console.log(`❌ Lỗi tạo question ${i + 1}:`, questionError.message);
            // Continue với questions khác, không throw error
          }
        }
        
        console.log("🎉 Hoàn thành tạo questions");
      } else {
        console.log("ℹ️ Không có questions để tạo");
      }
      
      return { data: quiz };
    } catch (error) {
      console.error("❌ QuizService.create error:", error);
      console.error("📍 Error stack:", error.stack);
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
