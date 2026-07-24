package com.raisetech.raisetimeline.mapper;

import com.raisetech.raisetimeline.domain.Comment;
import com.raisetech.raisetimeline.domain.CommentDetail;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Optional;

@Mapper
public interface CommentMapper {

    @Insert("INSERT INTO comments (post_id, user_id, content) "
            + "VALUES (#{postId}, #{userId}, #{content})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    void insert(Comment comment);

    @Select("SELECT * FROM comments WHERE id = #{id}")
    Optional<Comment> findById(Long id);

    @Delete("DELETE FROM comments WHERE id = #{id}")
    void deleteById(Long id);

    // comments × users のJOINを伴うため CommentMapper.xml 側で定義する
    List<CommentDetail> selectByPostId(@Param("postId") Long postId);

    Optional<CommentDetail> selectDetailById(@Param("id") Long id);
}
