package com.raisetech.raisetimeline.response;

import java.time.Instant;

public record CommentResponse(
        Long id,
        Long postId,
        String content,
        PostAuthorResponse author,
        Instant createdAt
) {
}
