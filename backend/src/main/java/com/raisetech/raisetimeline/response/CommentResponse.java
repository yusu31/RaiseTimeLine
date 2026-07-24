package com.raisetech.raisetimeline.response;

import java.time.LocalDateTime;

public record CommentResponse(
        Long id,
        Long postId,
        String content,
        PostAuthorResponse author,
        LocalDateTime createdAt
) {
}
