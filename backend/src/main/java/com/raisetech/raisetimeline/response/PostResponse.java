package com.raisetech.raisetimeline.response;

import java.time.LocalDateTime;

public record PostResponse(
        Long id,
        String content,
        String imageUrl,
        PostAuthorResponse author,
        int likeCount,
        int commentCount,
        boolean likedByMe,
        LocalDateTime createdAt
) {
}
