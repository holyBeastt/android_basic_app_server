// services/CourseService.js
import supabase from "../config/supabase.js";

class CourseService {
  async list(instructorId, { limit = 10, offset = 0, search = "", sortBy = "created_at", sortOrder = "desc" } = {}) {
    try {
      let query = supabase
        .from("courses")
        .select("*", { count: "exact" })
        .eq("user_id", instructorId);

      // Apply search
      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }

      // Apply sorting - support multiple fields
      const allowedSortFields = [
        'created_at', 'updated_at', 'title', 'price', 'discount_price', 
        'level', 'is_published', 'is_featured'
      ];
      
      if (allowedSortFields.includes(sortBy)) {
        query = query.order(sortBy, { ascending: sortOrder !== 'desc' });
      } else {
        // Default sort
        query = query.order("created_at", { ascending: false });
      }

      // Apply pagination
      if (limit) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error, count } = await query;

      if (error) {
        throw new Error(`Lỗi khi lấy danh sách khóa học: ${error.message}`);
      }

      return { data: data || [], total: count || 0 };
    } catch (error) {
      console.error("CourseService.list error:", error);
      throw error;
    }
  }

  async getOne(courseId, instructorId) {
    try {
      // Get course basic info first
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .eq("user_id", instructorId)
        .single();

      if (courseError) {
        throw new Error(`Lỗi khi lấy thông tin khóa học: ${courseError.message}`);
      }

      if (!course) {
        throw new Error("Không tìm thấy khóa học hoặc bạn không có quyền truy cập");
      }

      // Get sections separately
      const { data: sections, error: sectionsError } = await supabase
        .from("sections")
        .select("*")
        .eq("course_id", courseId)
        .order("order_index");

      if (sectionsError) {
        console.warn("Could not fetch sections:", sectionsError.message);
        course.sections = [];
      } else {
        course.sections = sections || [];
      }

      // For each section, get lessons
      for (const section of course.sections) {
        const { data: lessons, error: lessonsError } = await supabase
          .from("lessons")
          .select("*")
          .eq("section_id", section.id)
          .order("order_index");

        if (lessonsError) {
          console.warn("Could not fetch lessons:", lessonsError.message);
          section.lessons = [];
        } else {
          section.lessons = lessons || [];
        }

        // For each lesson, get quizzes
        for (const lesson of section.lessons) {
          const { data: quizzes, error: quizzesError } = await supabase
            .from("quizzes")
            .select("*")
            .eq("lesson_id", lesson.id);

          if (quizzesError) {
            console.warn("Could not fetch quizzes:", quizzesError.message);
            lesson.quizzes = [];
          } else {
            lesson.quizzes = quizzes || [];
          }

          // For each quiz, get questions
          for (const quiz of lesson.quizzes) {
            const { data: questions, error: questionsError } = await supabase
              .from("quiz_questions")
              .select("*")
              .eq("quiz_id", quiz.id)
              .order("order_index");

            if (questionsError) {
              console.warn("Could not fetch questions:", questionsError.message);
              quiz.quiz_questions = [];
            } else {
              quiz.quiz_questions = questions || [];
            }
          }
        }
      }

      return { data: course };
    } catch (error) {
      console.error("CourseService.getOne error:", error);
      throw error;
    }
  }

  async createSimple(instructorId, courseData) {
    try {
      // Đồng bộ tất cả trường với Supabase courses table
      const courseToCreate = {
        // Basic course info
        title: courseData.title,
        subtitle: courseData.subtitle || null,
        description: courseData.description,
        user_id: instructorId,
        user_name: courseData.user_name || courseData.username || null,
        
        // Category
        category_id: courseData.category_id || null,
        category_name: courseData.category_name || null,
        
        // Media URLs
        thumbnail_url: courseData.thumbnail_url || null,
        preview_video_url: courseData.preview_video_url || courseData.video_url || null,
        
        // Pricing
        price: courseData.price ? parseFloat(courseData.price) : 0,
        discount_price: courseData.discount_price ? parseFloat(courseData.discount_price) : null,
        discount_end_date: courseData.discount_end_date || null,
        
        // Course details
        level: courseData.level || "beginner",
        total_duration: courseData.total_duration || courseData.duration || null,
        total_lessons: courseData.total_lessons || null,
        
        // Course content
        requirements: courseData.requirements ? 
          (Array.isArray(courseData.requirements) ? courseData.requirements.join('\\n') : courseData.requirements) : null,
        what_you_learn: courseData.what_you_learn ? 
          (Array.isArray(courseData.what_you_learn) ? courseData.what_you_learn.join('\\n') : courseData.what_you_learn) : null,
        
        // Status flags
        is_published: courseData.is_published || false,
        is_featured: courseData.is_featured || false,
        
        // Stats (will be auto-calculated by triggers/functions in DB)
        rating: courseData.rating || null,
        student_count: courseData.student_count || 0,
        review_count: courseData.review_count || 0
      };

      const { data: course, error: courseError } = await supabase
        .from("courses")
        .insert([courseToCreate])
        .select()
        .single();

      if (courseError) {
        throw new Error(`Lỗi khi tạo khóa học: ${courseError.message}`);
      }

      return { data: course };
    } catch (error) {
      console.error("CourseService.createSimple error:", error);
      throw error;
    }
  }

  async createNested(instructorId, courseData) {
    try {
      // Extract nested data
      const { sections, ...courseFields } = courseData;
      
      // Create course
      const courseToCreate = {
        title: courseFields.title,
        subtitle: courseFields.subtitle,
        description: courseFields.description,
        user_id: instructorId,
        price: courseFields.price ? parseFloat(courseFields.price) : 0,
        discount_price: courseFields.discount_price ? parseFloat(courseFields.discount_price) : null,
        level: courseFields.level || "Beginner",
        total_duration: courseFields.duration || courseFields.total_duration || 0,
        requirements: courseFields.requirements ? 
          (Array.isArray(courseFields.requirements) ? courseFields.requirements.join('\\n') : courseFields.requirements) : null,
        what_you_learn: courseFields.what_you_learn ? 
          (Array.isArray(courseFields.what_you_learn) ? courseFields.what_you_learn.join('\\n') : courseFields.what_you_learn) : null
      };

      const { data: course, error: courseError } = await supabase
        .from("courses")
        .insert([courseToCreate])
        .select()
        .single();

      if (courseError) {
        throw new Error(`Lỗi khi tạo khóa học: ${courseError.message}`);
      }

      // Create nested sections if provided
      if (sections && Array.isArray(sections)) {
        for (const section of sections) {
          const { lessons, ...sectionFields } = section;
          
          const { data: createdSection, error: sectionError } = await supabase
            .from("sections")
            .insert([{
              ...sectionFields,
              course_id: course.id
            }])
            .select()
            .single();

          if (sectionError) {
            throw new Error(`Lỗi khi tạo section: ${sectionError.message}`);
          }

          // Create lessons if provided
          if (lessons && Array.isArray(lessons)) {
            for (const lesson of lessons) {
              const { quizzes, ...lessonFields } = lesson;
              
              const { data: createdLesson, error: lessonError } = await supabase
                .from("lessons")
                .insert([{
                  ...lessonFields,
                  section_id: createdSection.id,
                  course_id: course.id
                }])
                .select()
                .single();

              if (lessonError) {
                throw new Error(`Lỗi khi tạo lesson: ${lessonError.message}`);
              }

              // Create quizzes if provided
              if (quizzes && Array.isArray(quizzes)) {
                for (const quiz of quizzes) {
                  const { questions, ...quizFields } = quiz;
                  
                  const { data: createdQuiz, error: quizError } = await supabase
                    .from("quizzes")
                    .insert([{
                      ...quizFields,
                      lesson_id: createdLesson.id
                    }])
                    .select()
                    .single();

                  if (quizError) {
                    throw new Error(`Lỗi khi tạo quiz: ${quizError.message}`);
                  }

                  // Create questions if provided
                  if (questions && Array.isArray(questions)) {
                    const questionsToInsert = questions.map(question => ({
                      ...question,
                      quiz_id: createdQuiz.id
                    }));

                    const { error: questionsError } = await supabase
                      .from("quiz_questions")
                      .insert(questionsToInsert);

                    if (questionsError) {
                      throw new Error(`Lỗi khi tạo questions: ${questionsError.message}`);
                    }
                  }
                }
              }
            }
          }
        }
      }

      return { data: { id: course.id } };
    } catch (error) {
      console.error("CourseService.createNested error:", error);
      throw error;
    }
  }

  async updateNested(courseId, instructorId, updateData) {
    try {
      // Start transaction-like operations
      const { sections, ...rawCourseFields } = updateData;
      
      // Filter và validate course fields để đồng bộ với Supabase
      const courseFields = {};
      
      // Basic course info
      if (rawCourseFields.title !== undefined) courseFields.title = rawCourseFields.title;
      if (rawCourseFields.subtitle !== undefined) courseFields.subtitle = rawCourseFields.subtitle;
      if (rawCourseFields.description !== undefined) courseFields.description = rawCourseFields.description;
      if (rawCourseFields.user_name !== undefined) courseFields.user_name = rawCourseFields.user_name;
      
      // Category
      if (rawCourseFields.category_id !== undefined) courseFields.category_id = rawCourseFields.category_id;
      if (rawCourseFields.category_name !== undefined) courseFields.category_name = rawCourseFields.category_name;
      
      // Media URLs
      if (rawCourseFields.thumbnail_url !== undefined) courseFields.thumbnail_url = rawCourseFields.thumbnail_url;
      if (rawCourseFields.preview_video_url !== undefined) courseFields.preview_video_url = rawCourseFields.preview_video_url;
      
      // Pricing
      if (rawCourseFields.price !== undefined) courseFields.price = parseFloat(rawCourseFields.price) || 0;
      if (rawCourseFields.discount_price !== undefined) courseFields.discount_price = rawCourseFields.discount_price ? parseFloat(rawCourseFields.discount_price) : null;
      if (rawCourseFields.discount_end_date !== undefined) courseFields.discount_end_date = rawCourseFields.discount_end_date;
      
      // Course details
      if (rawCourseFields.level !== undefined) courseFields.level = rawCourseFields.level;
      if (rawCourseFields.total_duration !== undefined) courseFields.total_duration = rawCourseFields.total_duration;
      if (rawCourseFields.total_lessons !== undefined) courseFields.total_lessons = rawCourseFields.total_lessons;
      
      // Course content
      if (rawCourseFields.requirements !== undefined) {
        courseFields.requirements = rawCourseFields.requirements ? 
          (Array.isArray(rawCourseFields.requirements) ? rawCourseFields.requirements.join('\\n') : rawCourseFields.requirements) : null;
      }
      if (rawCourseFields.what_you_learn !== undefined) {
        courseFields.what_you_learn = rawCourseFields.what_you_learn ? 
          (Array.isArray(rawCourseFields.what_you_learn) ? rawCourseFields.what_you_learn.join('\\n') : rawCourseFields.what_you_learn) : null;
      }
      
      // Status flags
      if (rawCourseFields.is_published !== undefined) courseFields.is_published = rawCourseFields.is_published;
      if (rawCourseFields.is_featured !== undefined) courseFields.is_featured = rawCourseFields.is_featured;
      
      // Stats (normally auto-calculated, but allow manual override)
      if (rawCourseFields.rating !== undefined) courseFields.rating = rawCourseFields.rating;
      if (rawCourseFields.student_count !== undefined) courseFields.student_count = rawCourseFields.student_count;
      if (rawCourseFields.review_count !== undefined) courseFields.review_count = rawCourseFields.review_count;
      
      // Update course basic info
      if (Object.keys(courseFields).length > 0) {
        // Format timestamp for PostgreSQL compatibility
        const now = new Date().toISOString().replace('T', ' ').replace('Z', '+00');
        
        const { error: courseError } = await supabase
          .from("courses")
          .update({
            ...courseFields,
            updated_at: now
          })
          .eq("id", courseId)
          .eq("user_id", instructorId);

        if (courseError) {
          throw new Error(`Lỗi khi cập nhật khóa học: ${courseError.message}`);
        }
      }

      // Handle nested sections if provided
      if (sections && Array.isArray(sections)) {
        for (const section of sections) {
          if (section.id) {
            // Update existing section
            const { lessons, ...sectionFields } = section;
            if (Object.keys(sectionFields).length > 1) { // More than just id
              await supabase
                .from("sections")
                .update(sectionFields)
                .eq("id", section.id)
                .eq("course_id", courseId);
            }
            
            // Handle lessons in this section
            if (lessons && Array.isArray(lessons)) {
              for (const lesson of lessons) {
                if (lesson.id) {
                  // Update existing lesson
                  const { quizzes, ...lessonFields } = lesson;
                  if (Object.keys(lessonFields).length > 1) {
                    await supabase
                      .from("lessons")
                      .update(lessonFields)
                      .eq("id", lesson.id)
                      .eq("section_id", section.id);
                  }
                  
                  // Handle quizzes in this lesson
                  if (quizzes && Array.isArray(quizzes)) {
                    for (const quiz of quizzes) {
                      if (quiz.id) {
                        // Update existing quiz
                        const { questions, ...quizFields } = quiz;
                        if (Object.keys(quizFields).length > 1) {
                          await supabase
                            .from("quizzes")
                            .update(quizFields)
                            .eq("id", quiz.id)
                            .eq("lesson_id", lesson.id);
                        }
                        
                        // Handle questions in this quiz
                        if (questions && Array.isArray(questions)) {
                          for (const question of questions) {
                            if (question.id) {
                              // Update existing question
                              if (Object.keys(question).length > 1) {
                                await supabase
                                  .from("quiz_questions")
                                  .update(question)
                                  .eq("id", question.id)
                                  .eq("quiz_id", quiz.id);
                              }
                            } else {
                              // Create new question
                              await supabase
                                .from("quiz_questions")
                                .insert([{ ...question, quiz_id: quiz.id }]);
                            }
                          }
                        }
                      } else {
                        // Create new quiz with questions
                        const { questions: newQuestions, ...newQuizFields } = quiz;
                        const { data: createdQuiz } = await supabase
                          .from("quizzes")
                          .insert([{ ...newQuizFields, lesson_id: lesson.id }])
                          .select()
                          .single();
                        
                        if (newQuestions && Array.isArray(newQuestions)) {
                          const questionsToInsert = newQuestions.map(q => ({
                            ...q,
                            quiz_id: createdQuiz.id
                          }));
                          await supabase
                            .from("quiz_questions")
                            .insert(questionsToInsert);
                        }
                      }
                    }
                  }
                } else {
                  // Create new lesson with nested data
                  const { quizzes: newQuizzes, ...newLessonFields } = lesson;
                  const { data: createdLesson } = await supabase
                    .from("lessons")
                    .insert([{ ...newLessonFields, section_id: section.id, course_id: courseId }])
                    .select()
                    .single();
                  
                  // Create quizzes for new lesson if provided
                  if (newQuizzes && Array.isArray(newQuizzes)) {
                    for (const quiz of newQuizzes) {
                      const { questions: quizQuestions, ...quizFields } = quiz;
                      const { data: createdQuiz } = await supabase
                        .from("quizzes")
                        .insert([{ ...quizFields, lesson_id: createdLesson.id }])
                        .select()
                        .single();
                      
                      if (quizQuestions && Array.isArray(quizQuestions)) {
                        const questionsToInsert = quizQuestions.map(q => ({
                          ...q,
                          quiz_id: createdQuiz.id
                        }));
                        await supabase
                          .from("quiz_questions")
                          .insert(questionsToInsert);
                      }
                    }
                  }
                }
              }
            }
          } else {
            // Create new section with nested data
            const { lessons: newLessons, ...newSectionFields } = section;
            const { data: createdSection } = await supabase
              .from("sections")
              .insert([{ ...newSectionFields, course_id: courseId }])
              .select()
              .single();
            
            // Create lessons for new section if provided
            if (newLessons && Array.isArray(newLessons)) {
              for (const lesson of newLessons) {
                const { quizzes: lessonQuizzes, ...lessonFields } = lesson;
                const { data: createdLesson } = await supabase
                  .from("lessons")
                  .insert([{ ...lessonFields, section_id: createdSection.id, course_id: courseId }])
                  .select()
                  .single();
                
                if (lessonQuizzes && Array.isArray(lessonQuizzes)) {
                  for (const quiz of lessonQuizzes) {
                    const { questions: quizQuestions, ...quizFields } = quiz;
                    const { data: createdQuiz } = await supabase
                      .from("quizzes")
                      .insert([{ ...quizFields, lesson_id: createdLesson.id }])
                      .select()
                      .single();
                    
                    if (quizQuestions && Array.isArray(quizQuestions)) {
                      const questionsToInsert = quizQuestions.map(q => ({
                        ...q,
                        quiz_id: createdQuiz.id
                      }));
                      await supabase
                        .from("quiz_questions")
                        .insert(questionsToInsert);
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Get updated course with full tree
      return await this.getOne(courseId, instructorId);
    } catch (error) {
      console.error("CourseService.updateNested error:", error);
      throw error;
    }
  }

  async getRevenueStats(instructorId) {
    try {
      // Lấy thông tin tổng quan khóa học của giảng viên
      const { data: courses, error: coursesError } = await supabase
        .from("courses")
        .select(`
          id,
          title,
          user_name,
          price,
          discount_price,
          student_count,
          created_at
        `)
        .eq("user_id", instructorId);

      if (coursesError) {
        throw new Error(`Lỗi khi lấy danh sách khóa học: ${coursesError.message}`);
      }

      if (!courses || courses.length === 0) {
        return {
          data: {
            totalRevenue: 0,
            totalStudents: 0,
            totalCourses: 0,
            courses: [],
            instructorName: null
          }
        };
      }

      // Tính toán tổng doanh thu và tổng học viên
      let totalRevenue = 0;
      let totalStudents = 0;
      const instructorName = courses[0].user_name;

      const courseStats = courses.map(course => {
        // Sử dụng giá giảm nếu có, nếu không dùng giá gốc
        const effectivePrice = course.discount_price || course.price || 0;
        const studentCount = course.student_count || 0;
        const courseRevenue = effectivePrice * studentCount;
        
        totalRevenue += courseRevenue;
        totalStudents += studentCount;

        return {
          id: course.id,
          title: course.title,
          price: course.price,
          discount_price: course.discount_price,
          effective_price: effectivePrice,
          student_count: studentCount,
          course_revenue: courseRevenue,
          created_at: course.created_at
        };
      });

      return {
        data: {
          totalRevenue,
          totalStudents,
          totalCourses: courses.length,
          instructorName,
          courses: courseStats
        }
      };
    } catch (error) {
      console.error("CourseService.getRevenueStats error:", error);
      throw error;
    }
  }

  async delete(courseId, instructorId) {
    try {
      // Verify ownership
      const { data: course, error: checkError } = await supabase
        .from("courses")
        .select("id")
        .eq("id", courseId)
        .eq("user_id", instructorId)
        .single();

      if (checkError || !course) {
        throw new Error("Không tìm thấy khóa học hoặc bạn không có quyền xóa");
      }

      // Delete course (cascade will handle related data)
      const { error: deleteError } = await supabase
        .from("courses")
        .delete()
        .eq("id", courseId)
        .eq("user_id", instructorId);

      if (deleteError) {
        throw new Error(`Lỗi khi xóa khóa học: ${deleteError.message}`);
      }

      return true;
    } catch (error) {
      console.error("CourseService.delete error:", error);
      throw error;
    }
  }
}

export default new CourseService();
