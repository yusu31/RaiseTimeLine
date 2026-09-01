package com.raisetech.raisetimeline.response;

/**
 * ユーザー検索結果の1件分。
 * 検索結果にはフォローボタンを出さないため、{@link FollowUserResponse} と違い followedByMe を持たない。
 */
public record UserSearchResultResponse(
        Long id,
        String username,
        String displayName,
        String iconImageUrl
) {
}
