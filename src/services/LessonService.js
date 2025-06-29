// services/LessonService.js
import supabase from "../config/supabase.js";

class LessonService {
  async create(sectionId, instructorId, lessonData) {
    try {
      // Simple verification: check if section exists and belongs to instructor
      const { data: section, error: sectionError } = await supabase
        .from("sections")
        .select("id, course_id")
        .eq("id", sectionId)
        .single();

      if (sectionError || !section) {
        throw new Error("Không tìm thấy section");
      }

      // Check if course belongs to instructor
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("id")
        .eq("id", section.course_id)
        .eq("user_id", instructorId)
        .single();

      if (courseError || !course) {
        throw new Error("Bạn không có quyền truy cập section này");
      }

      const { data: lesson, error } = await supabase
        .from("lessons")
        .insert([{
          ...lessonData,
          section_id: sectionId,
          course_id: section.course_id
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Lỗi khi tạo lesson: ${error.message}`);
      }

      return { data: lesson };
    } catch (error) {
      console.error("LessonService.create error:", error);
      throw error;
    }
  }

  async update(lessonId, instructorId, updateData) {
    try {
      // First verify ownership through section->course
      const { data: lesson, error: checkError } = await supabase
        .from("lessons")
        .select(`
          id,
          section_id,
          sections!inner (
            course_id,
            courses!inner (
              user_id
            )
          )
        `)
        .eq("id", lessonId)
        .eq("sections.courses.user_id", instructorId)
        .single();

      if (checkError || !lesson) {
        throw new Error("Không tìm thấy lesson hoặc bạn không có quyền sửa");
      }

      const { data: updatedLesson, error } = await supabase
        .from("lessons")
        .update(updateData)
        .eq("id", lessonId)
        .select()
        .single();

      if (error) {
        throw new Error(`Lỗi khi cập nhật lesson: ${error.message}`);
      }

      return { data: updatedLesson };
    } catch (error) {
      console.error("LessonService.update error:", error);
      throw error;
    }
  }

  async delete(lessonId, instructorId) {
    try {
      // Verify ownership through section -> course
      const { data: lesson, error: checkError } = await supabase
        .from("lessons")
        .select(`
          id,
          section_id,
          sections!inner (
            course_id,
            courses!inner (
              user_id
            )
          )
        `)
        .eq("id", lessonId)
        .eq("sections.courses.user_id", instructorId)
        .single();

      if (checkError || !lesson) {
        throw new Error("Không tìm thấy lesson hoặc bạn không có quyền xóa");
      }

      const { error: deleteError } = await supabase
        .from("lessons")
        .delete()
        .eq("id", lessonId);

      if (deleteError) {
        throw new Error(`Lỗi khi xóa lesson: ${deleteError.message}`);
      }

      return true;
    } catch (error) {
      console.error("LessonService.delete error:", error);
      throw error;
    }
  }
}

export default new LessonService();
