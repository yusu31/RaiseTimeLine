package com.raisetech.raisetimeline.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * SQLはすべて resources/mapper/LikeMapper.xml に定義する。
 */
@Mapper
public interface LikeMapper {

    void insertIgnoreDuplicate(@Param("postId") Long postId, @Param("userId") Long userId);

    void delete(@Param("postId") Long postId, @Param("userId") Long userId);

    int countByPostId(@Param("postId") Long postId);

    boolean exists(@Param("postId") Long postId, @Param("userId") Long userId);
}
