package com.raisetech.raisetimeline.mapper;

import com.raisetech.raisetimeline.domain.Post;
import com.raisetech.raisetimeline.domain.PostDetail;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Optional;

/**
 * SQLはすべて resources/mapper/PostMapper.xml に定義する。
 */
@Mapper
public interface PostMapper {

    void insert(Post post);

    Optional<Post> findById(@Param("id") Long id);

    void updateContent(@Param("id") Long id, @Param("content") String content);

    void deleteById(@Param("id") Long id);

    List<PostDetail> selectTimeline(@Param("limit") int limit, @Param("offset") int offset,
                                     @Param("currentUserId") Long currentUserId);

    List<PostDetail> selectByAuthorId(@Param("authorId") Long authorId, @Param("limit") int limit,
                                       @Param("offset") int offset, @Param("currentUserId") Long currentUserId);

    /**
     * 「フォロー中」タブ用のタイムライン。currentUserId 自身の投稿も含む。
     */
    List<PostDetail> selectFollowingTimeline(@Param("limit") int limit, @Param("offset") int offset,
                                              @Param("currentUserId") Long currentUserId);

    Optional<PostDetail> selectDetailById(@Param("id") Long id, @Param("currentUserId") Long currentUserId);

    long countNewerThan(@Param("afterId") long afterId);

    List<PostDetail> selectNewerThan(@Param("afterId") long afterId, @Param("limit") int limit,
                                      @Param("currentUserId") Long currentUserId);
}
