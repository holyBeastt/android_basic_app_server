// services/SectionService.js
import supabase from "../config/supabase.js";

class SectionService {
  async create(courseId, instructorId, sectionData) {
    try {
      // Verify course ownership
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("id")
        .eq("id", courseId)
        .eq("user_id", instructorId)
        .single();

      if (courseError || !course) {
        throw new Error("Không tìm thấy khóa học hoặc bạn không có quyền truy cập");
      }

      const { data: section, error } = await supabase
        .from("sections")
        .insert([{
          ...sectionData,
          course_id: courseId
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Lỗi khi tạo section: ${error.message}`);
      }

      return { data: section };
    } catch (error) {
      console.error("SectionService.create error:", error);
      throw error;
    }
  }

  async update(sectionId, instructorId, updateData) {
    try {
      // First verify ownership through course
      const { data: section, error: checkError } = await supabase
        .from("sections")
        .select(`
          id,
          course_id,
          courses!inner (
            user_id
          )
        `)
        .eq("id", sectionId)
        .eq("courses.user_id", instructorId)
        .single();

      if (checkError || !section) {
        throw new Error("Không tìm thấy section hoặc bạn không có quyền sửa");
      }

      const { data: updatedSection, error } = await supabase
        .from("sections")
        .update(updateData)
        .eq("id", sectionId)
        .select()
        .single();

      if (error) {
        throw new Error(`Lỗi khi cập nhật section: ${error.message}`);
      }

      return { data: updatedSection };
    } catch (error) {
      console.error("SectionService.update error:", error);
      throw error;
    }
  }

  async delete(sectionId, instructorId) {
    try {
      // Verify ownership through course
      const { data: section, error: checkError } = await supabase
        .from("sections")
        .select(`
          id,
          course_id,
          courses!inner (
            user_id
          )
        `)
        .eq("id", sectionId)
        .eq("courses.user_id", instructorId)
        .single();

      if (checkError || !section) {
        throw new Error("Không tìm thấy section hoặc bạn không có quyền xóa");
      }

      const { error: deleteError } = await supabase
        .from("sections")
        .delete()
        .eq("id", sectionId);

      if (deleteError) {
        throw new Error(`Lỗi khi xóa section: ${deleteError.message}`);
      }

      return true;
    } catch (error) {
      console.error("SectionService.delete error:", error);
      throw error;
    }
  }
}

export default new SectionService();
