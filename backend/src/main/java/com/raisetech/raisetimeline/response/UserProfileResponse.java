package com.raisetech.raisetimeline.response;

import java.time.LocalDateTime;

/**
 * プロフィール画面に表示するユーザー情報。
 * 投稿一覧は件数が多くページングが必要なため、このレスポンスには含めず
 * {@code GET /api/users/{username}/posts} で別途取得する。
 * <p>
 * フォロー数と followedByMe（閲覧者がこのユーザーをフォロー中か）は
 * プロフィール取得と同じ1クエリで取得している。
 */
public record UserProfileResponse(
        Long id,
        String username,
        String displayName,
        String bio,
        String iconImageUrl,
        LocalDateTime createdAt,
        int followingCount,
        int followerCount,
        boolean followedByMe
) {
}
