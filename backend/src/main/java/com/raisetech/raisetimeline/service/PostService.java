package com.raisetech.raisetimeline.service;

import com.raisetech.raisetimeline.domain.Post;
import com.raisetech.raisetimeline.domain.PostDetail;
import com.raisetech.raisetimeline.exception.InvalidPostContentException;
import com.raisetech.raisetimeline.exception.PostAccessDeniedException;
import com.raisetech.raisetimeline.exception.PostNotFoundException;
import com.raisetech.raisetimeline.mapper.PostMapper;
import com.raisetech.raisetimeline.request.PostCreateRequest;
import com.raisetech.raisetimeline.request.PostUpdateRequest;
import com.raisetech.raisetimeline.response.NewPostsCountResponse;
import com.raisetech.raisetimeline.response.NewPostsResponse;
import com.raisetech.raisetimeline.response.PostAuthorResponse;
import com.raisetech.raisetimeline.response.PostListResponse;
import com.raisetech.raisetimeline.response.PostResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class PostService {

    private static final int MAX_CONTENT_LENGTH = 280;
    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final int NEW_POSTS_FETCH_LIMIT = 50;

    private final PostMapper postMapper;
    private final StorageService storageService;

    public PostService(PostMapper postMapper, StorageService storageService) {
        this.postMapper = postMapper;
        this.storageService = storageService;
    }

    @Transactional(readOnly = true)
    public PostListResponse getTimeline(int page, int size, Long currentUserId) {
        int normalizedPage = Math.max(page, 0);
        int normalizedSize = (size < 1 || size > MAX_PAGE_SIZE) ? DEFAULT_PAGE_SIZE : size;
        int offset = normalizedPage * normalizedSize;

        // size+1件取得してhasNextを判定する（COUNT(*)を別途発行しない軽量な方式）
        List<PostDetail> rows = postMapper.selectTimeline(normalizedSize + 1, offset, currentUserId);
        boolean hasNext = rows.size() > normalizedSize;
        List<PostDetail> pageRows = hasNext ? rows.subList(0, normalizedSize) : rows;

        List<PostResponse> posts = pageRows.stream().map(this::toResponse).toList();
        return new PostListResponse(posts, normalizedPage, hasNext);
    }

    @Transactional(readOnly = true)
    public NewPostsCountResponse getNewPostsCount(long afterId) {
        long normalizedAfterId = Math.max(afterId, 0);
        return new NewPostsCountResponse(postMapper.countNewerThan(normalizedAfterId));
    }

    @Transactional(readOnly = true)
    public NewPostsResponse getNewPosts(long afterId, Long currentUserId) {
        long normalizedAfterId = Math.max(afterId, 0);

        // size+1件取得してhasMoreを判定する（getTimelineと同じ軽量な方式）
        List<PostDetail> rows = postMapper.selectNewerThan(normalizedAfterId, NEW_POSTS_FETCH_LIMIT + 1, currentUserId);
        boolean hasMore = rows.size() > NEW_POSTS_FETCH_LIMIT;
        List<PostDetail> limitedRows = hasMore ? rows.subList(0, NEW_POSTS_FETCH_LIMIT) : rows;

        List<PostResponse> posts = limitedRows.stream().map(this::toResponse).toList();
        return new NewPostsResponse(posts, hasMore);
    }

    @Transactional(readOnly = true)
    public PostResponse getPost(Long id, Long currentUserId) {
        PostDetail detail = postMapper.selectDetailById(id, currentUserId)
                .orElseThrow(() -> new PostNotFoundException("投稿が見つかりません"));
        return toResponse(detail);
    }

    public PostResponse create(Long userId, PostCreateRequest request) {
        validateContent(request.content());

        String imagePath = null;
        if (request.image() != null && !request.image().isEmpty()) {
            imagePath = storageService.store(request.image());
        }

        Post post = new Post();
        post.setUserId(userId);
        post.setContent(request.content());
        post.setImagePath(imagePath);
        postMapper.insert(post);

        return getPost(post.getId(), userId);
    }

    public PostResponse update(Long userId, Long postId, PostUpdateRequest request) {
        findOwnedPostOrThrow(userId, postId);
        postMapper.updateContent(postId, request.content());
        return getPost(postId, userId);
    }

    public void delete(Long userId, Long postId) {
        Post post = findOwnedPostOrThrow(userId, postId);
        postMapper.deleteById(postId);
        if (post.getImagePath() != null) {
            storageService.delete(post.getImagePath());
        }
    }

    private Post findOwnedPostOrThrow(Long userId, Long postId) {
        Post post = postMapper.findById(postId)
                .orElseThrow(() -> new PostNotFoundException("投稿が見つかりません"));
        if (!post.getUserId().equals(userId)) {
            throw new PostAccessDeniedException("この投稿を操作する権限がありません");
        }
        return post;
    }

    private void validateContent(String content) {
        if (content == null || content.isBlank() || content.length() > MAX_CONTENT_LENGTH) {
            throw new InvalidPostContentException("本文は1〜280文字で入力してください");
        }
    }

    private PostResponse toResponse(PostDetail detail) {
        String imageUrl = detail.getImagePath() != null ? storageService.toPublicUrl(detail.getImagePath()) : null;
        PostAuthorResponse author = new PostAuthorResponse(detail.getAuthorId(), detail.getAuthorDisplayName());
        return new PostResponse(detail.getId(), detail.getContent(), imageUrl, author,
                detail.getLikeCount(), detail.getCommentCount(), detail.isLikedByMe(), detail.getCreatedAt());
    }
}
