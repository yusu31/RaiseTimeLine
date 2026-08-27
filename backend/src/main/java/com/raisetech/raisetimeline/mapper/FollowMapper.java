package com.raisetech.raisetimeline.mapper;

import com.raisetech.raisetimeline.domain.FollowUserDetail;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * SQLはすべて resources/mapper/FollowMapper.xml に定義する。
 */
@Mapper
public interface FollowMapper {

    void insertIgnoreDuplicate(@Param("followerId") Long followerId, @Param("followingId") Long followingId);

    void delete(@Param("followerId") Long followerId, @Param("followingId") Long followingId);

    boolean exists(@Param("followerId") Long followerId, @Param("followingId") Long followingId);

    int countFollowers(@Param("userId") Long userId);

    /**
     * userId がフォローしている人の一覧。
     * followedByMe は「一覧を見ている人(currentUserId)がその相手をフォロー中か」を表す。
     */
    List<FollowUserDetail> selectFollowing(@Param("userId") Long userId,
                                           @Param("currentUserId") Long currentUserId);

    /**
     * userId をフォローしている人の一覧。
     */
    List<FollowUserDetail> selectFollowers(@Param("userId") Long userId,
                                            @Param("currentUserId") Long currentUserId);
}
