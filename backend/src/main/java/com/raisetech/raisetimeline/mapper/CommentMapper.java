package com.raisetech.raisetimeline.mapper;

import com.raisetech.raisetimeline.domain.Comment;
import com.raisetech.raisetimeline.domain.CommentDetail;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Optional;

/**
 * SQLはすべて resources/mapper/CommentMapper.xml に定義する。
 */
@Mapper
public interface CommentMapper {

    void insert(Comment comment);

    Optional<Comment> findById(@Param("id") Long id);

    void deleteById(@Param("id") Long id);

    List<CommentDetail> selectByPostId(@Param("postId") Long postId);

    Optional<CommentDetail> selectDetailById(@Param("id") Long id);
}
