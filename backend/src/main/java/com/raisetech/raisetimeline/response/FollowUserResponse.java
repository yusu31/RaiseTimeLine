package com.raisetech.raisetimeline.response;

/**
 * フォロー中／フォロワー一覧の1件分。
 * 一覧の各行にフォローボタンを出すため followedByMe を含む。
 */
public record FollowUserResponse(
        Long id,
        String username,
        String displayName,
        String iconImageUrl,
        boolean followedByMe
) {
}
