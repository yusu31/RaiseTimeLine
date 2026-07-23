package com.raisetech.raisetimeline.mapper;

import com.raisetech.raisetimeline.domain.Post;
import com.raisetech.raisetimeline.domain.PostDetail;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;
import java.util.Optional;

@Mapper
public interface PostMapper {

    @Insert("INSERT INTO posts (user_id, content, image_path) "
            + "VALUES (#{userId}, #{content}, #{imagePath})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    void insert(Post post);

    @Select("SELECT * FROM posts WHERE id = #{id}")
    Optional<Post> findById(Long id);

    @Update("UPDATE posts SET content = #{content}, updated_at = CURRENT_TIMESTAMP WHERE id = #{id}")
    void updateContent(@Param("id") Long id, @Param("content") String content);

    @Delete("DELETE FROM posts WHERE id = #{id}")
    void deleteById(Long id);

    // posts × users のJOINを伴うため PostMapper.xml 側で定義する
    List<PostDetail> selectTimeline(@Param("limit") int limit, @Param("offset") int offset);

    Optional<PostDetail> selectDetailById(@Param("id") Long id);
}
