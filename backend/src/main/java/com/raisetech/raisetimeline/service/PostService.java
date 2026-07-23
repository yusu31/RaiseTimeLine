package com.raisetech.raisetimeline.service;

import com.raisetech.raisetimeline.domain.Post;
import com.raisetech.raisetimeline.domain.PostDetail;
import com.raisetech.raisetimeline.exception.InvalidPostContentException;
import com.raisetech.raisetimeline.exception.PostAccessDeniedException;
import com.raisetech.raisetimeline.exception.PostNotFoundException;
import com.raisetech.raisetimeline.mapper.PostMapper;
import com.raisetech.raisetimeline.request.PostCreateRequest;
import com.raisetech.raisetimeline.request.PostUpdateRequest;
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

    private final PostMapper postMapper;
    private final StorageService storageService;

    public PostService(PostMapper postMapper, StorageService storageService) {
        this.postMapper = postMapper;
        this.storageService = storageService;
    }

    @Transactional(readOnly = true)
    public PostListResponse getTimeline(int page, int size) {
        int normalizedPage = Math.max(page, 0);
        int normalizedSize = (size < 1 || size > MAX_PAGE_SIZE) ? DEFAULT_PAGE_SIZE : size;
        int offset = normalizedPage * normalizedSize;

        // size+1件取得してhasNextを判定する（COUNT(*)を別途発行しない軽量な方式）
        List<PostDetail> rows = postMapper.selectTimeline(normalizedSize + 1, offset);
        boolean hasNext = rows.size() > normalizedSize;
        List<PostDetail> pageRows = hasNext ? rows.subList(0, normalizedSize) : rows;

        List<PostResponse> posts = pageRows.stream().map(this::toResponse).toList();
        return new PostListResponse(posts, normalizedPage, hasNext);
    }

    @Transactional(readOnly = true)
    public PostResponse getPost(Long id) {
        PostDetail detail = postMapper.selectDetailById(id)
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

        return getPost(post.getId());
    }

    public PostResponse update(Long userId, Long postId, PostUpdateRequest request) {
        findOwnedPostOrThrow(userId, postId);
        postMapper.updateContent(postId, request.content());
        return getPost(postId);
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
        // likeCount/commentCount/likedByMeはF-03/F-04未実装のため固定値で返す
        return new PostResponse(detail.getId(), detail.getContent(), imageUrl, author, 0, 0, false, detail.getCreatedAt());
    }
}
