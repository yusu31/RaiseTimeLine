package com.raisetech.raisetimeline.service;

import com.raisetech.raisetimeline.domain.Comment;
import com.raisetech.raisetimeline.domain.CommentDetail;
import com.raisetech.raisetimeline.exception.CommentAccessDeniedException;
import com.raisetech.raisetimeline.exception.CommentNotFoundException;
import com.raisetech.raisetimeline.exception.InvalidCommentContentException;
import com.raisetech.raisetimeline.exception.PostNotFoundException;
import com.raisetech.raisetimeline.mapper.CommentMapper;
import com.raisetech.raisetimeline.mapper.PostMapper;
import com.raisetech.raisetimeline.request.CommentCreateRequest;
import com.raisetech.raisetimeline.response.CommentResponse;
import com.raisetech.raisetimeline.response.PostAuthorResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class CommentService {

    private static final int MAX_CONTENT_LENGTH = 280;

    private final CommentMapper commentMapper;
    private final PostMapper postMapper;

    public CommentService(CommentMapper commentMapper, PostMapper postMapper) {
        this.commentMapper = commentMapper;
        this.postMapper = postMapper;
    }

    @Transactional(readOnly = true)
    public List<CommentResponse> getComments(Long postId) {
        findPostOrThrow(postId);
        return commentMapper.selectByPostId(postId).stream().map(this::toResponse).toList();
    }

    public CommentResponse create(Long userId, Long postId, CommentCreateRequest request) {
        findPostOrThrow(postId);
        validateContent(request.content());

        Comment comment = new Comment();
        comment.setPostId(postId);
        comment.setUserId(userId);
        comment.setContent(request.content());
        commentMapper.insert(comment);

        CommentDetail detail = commentMapper.selectDetailById(comment.getId())
                .orElseThrow(() -> new CommentNotFoundException("コメントが見つかりません"));
        return toResponse(detail);
    }

    public void delete(Long userId, Long commentId) {
        Comment comment = commentMapper.findById(commentId)
                .orElseThrow(() -> new CommentNotFoundException("コメントが見つかりません"));
        if (!comment.getUserId().equals(userId)) {
            throw new CommentAccessDeniedException("このコメントを操作する権限がありません");
        }
        commentMapper.deleteById(commentId);
    }

    private void findPostOrThrow(Long postId) {
        postMapper.findById(postId)
                .orElseThrow(() -> new PostNotFoundException("投稿が見つかりません"));
    }

    private void validateContent(String content) {
        if (content == null || content.isBlank() || content.length() > MAX_CONTENT_LENGTH) {
            throw new InvalidCommentContentException("コメントは1〜280文字で入力してください");
        }
    }

    private CommentResponse toResponse(CommentDetail detail) {
        PostAuthorResponse author = new PostAuthorResponse(detail.getAuthorId(), detail.getAuthorDisplayName());
        return new CommentResponse(detail.getId(), detail.getPostId(), detail.getContent(), author, detail.getCreatedAt());
    }
}
