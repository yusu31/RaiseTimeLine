package com.raisetech.raisetimeline.response;

/**
 * フォロー／フォロー解除の結果。LikeStatusResponse と同じ形で、
 * 操作後の最新状態（対象ユーザーのフォロワー数・自分がフォロー中か）を返す。
 * 画面側はこの値をそのまま表示すればよく、再取得の往復が不要になる。
 */
public record FollowStatusResponse(
        int followerCount,
        boolean followedByMe
) {
}
