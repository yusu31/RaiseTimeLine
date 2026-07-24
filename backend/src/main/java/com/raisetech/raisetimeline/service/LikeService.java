package com.raisetech.raisetimeline.service;

import com.raisetech.raisetimeline.exception.PostNotFoundException;
import com.raisetech.raisetimeline.mapper.LikeMapper;
import com.raisetech.raisetimeline.mapper.PostMapper;
import com.raisetech.raisetimeline.response.LikeStatusResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class LikeService {

    private final LikeMapper likeMapper;
    private final PostMapper postMapper;

    public LikeService(LikeMapper likeMapper, PostMapper postMapper) {
        this.likeMapper = likeMapper;
        this.postMapper = postMapper;
    }

    public LikeStatusResponse like(Long userId, Long postId) {
        findPostOrThrow(postId);
        likeMapper.insertIgnoreDuplicate(postId, userId);
        return currentStatus(postId, userId);
    }

    public LikeStatusResponse unlike(Long userId, Long postId) {
        findPostOrThrow(postId);
        likeMapper.delete(postId, userId);
        return currentStatus(postId, userId);
    }

    private void findPostOrThrow(Long postId) {
        postMapper.findById(postId)
                .orElseThrow(() -> new PostNotFoundException("投稿が見つかりません"));
    }

    private LikeStatusResponse currentStatus(Long postId, Long userId) {
        int likeCount = likeMapper.countByPostId(postId);
        boolean likedByMe = likeMapper.exists(postId, userId);
        return new LikeStatusResponse(likeCount, likedByMe);
    }
}
