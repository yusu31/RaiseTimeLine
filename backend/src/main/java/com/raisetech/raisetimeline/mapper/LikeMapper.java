package com.raisetech.raisetimeline.mapper;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface LikeMapper {

    // ユニーク制約(post_id, user_id)違反はON CONFLICT DO NOTHINGで無害化し、二重いいねを冪等に成功させる
    @Insert("INSERT INTO likes (post_id, user_id) VALUES (#{postId}, #{userId}) "
            + "ON CONFLICT (post_id, user_id) DO NOTHING")
    void insertIgnoreDuplicate(@Param("postId") Long postId, @Param("userId") Long userId);

    @Delete("DELETE FROM likes WHERE post_id = #{postId} AND user_id = #{userId}")
    void delete(@Param("postId") Long postId, @Param("userId") Long userId);

    @Select("SELECT COUNT(*) FROM likes WHERE post_id = #{postId}")
    int countByPostId(@Param("postId") Long postId);

    @Select("SELECT EXISTS(SELECT 1 FROM likes WHERE post_id = #{postId} AND user_id = #{userId})")
    boolean exists(@Param("postId") Long postId, @Param("userId") Long userId);
}
