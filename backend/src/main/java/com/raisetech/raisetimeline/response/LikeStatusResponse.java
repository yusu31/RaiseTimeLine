package com.raisetech.raisetimeline.response;

public record LikeStatusResponse(
        int likeCount,
        boolean likedByMe
) {
}
