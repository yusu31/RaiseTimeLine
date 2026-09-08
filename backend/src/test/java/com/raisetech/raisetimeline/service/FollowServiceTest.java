package com.raisetech.raisetimeline.service;

import com.raisetech.raisetimeline.domain.FollowUserDetail;
import com.raisetech.raisetimeline.domain.User;
import com.raisetech.raisetimeline.exception.SelfFollowException;
import com.raisetech.raisetimeline.exception.UserNotFoundException;
import com.raisetech.raisetimeline.mapper.FollowMapper;
import com.raisetech.raisetimeline.mapper.UserMapper;
import com.raisetech.raisetimeline.response.FollowStatusResponse;
import com.raisetech.raisetimeline.response.FollowUserResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link FollowService} のテスト。
 *
 * <p>最も重要なのは<strong>自分自身のフォローを Service 層で先に弾いているか</strong>。
 * DBには CHECK 制約（ck_follows_not_self）があるが、そこに任せると
 * {@code ON CONFLICT DO NOTHING} で無害化できない違反として例外が飛び、500 になってしまう。
 * DB制約は最後の砦であって、一次防衛ではない。</p>
 */
@ExtendWith(MockitoExtension.class)
class FollowServiceTest {

    private static final long FOLLOWER_ID = 10L;
    private static final long TARGET_ID = 20L;
    private static final String TARGET_USERNAME = "suzuki";

    @Mock
    private FollowMapper followMapper;

    @Mock
    private UserMapper userMapper;

    @Mock
    private StorageService storageService;

    @InjectMocks
    private FollowService followService;

    private User user(long id, String username) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setDisplayName(username + "さん");
        return user;
    }

    private void givenTargetExists() {
        when(userMapper.findByUsername(TARGET_USERNAME)).thenReturn(Optional.of(user(TARGET_ID, TARGET_USERNAME)));
    }

    private FollowUserDetail followUserDetail(String iconImagePath) {
        FollowUserDetail detail = new FollowUserDetail();
        detail.setId(TARGET_ID);
        detail.setUsername(TARGET_USERNAME);
        detail.setDisplayName("鈴木");
        detail.setIconImagePath(iconImagePath);
        detail.setFollowedByMe(true);
        return detail;
    }

    @Test
    @DisplayName("follow: 相手が存在しなければ UserNotFoundException を投げ、フォローを登録しない")
    void throwsWhenTargetUserNotFound() {
        when(userMapper.findByUsername(TARGET_USERNAME)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> followService.follow(FOLLOWER_ID, TARGET_USERNAME))
                .isInstanceOf(UserNotFoundException.class);

        verify(followMapper, never()).insertIgnoreDuplicate(anyLong(), anyLong());
    }

    @Test
    @DisplayName("follow: 自分自身をフォローしようとすると SelfFollowException を投げ、DBには問い合わせない")
    void rejectsSelfFollowBeforeTouchingDatabase() {
        when(userMapper.findByUsername(TARGET_USERNAME))
                .thenReturn(Optional.of(user(FOLLOWER_ID, TARGET_USERNAME)));

        assertThatThrownBy(() -> followService.follow(FOLLOWER_ID, TARGET_USERNAME))
                .isInstanceOf(SelfFollowException.class);

        // ここで弾かないと、DBの CHECK 制約違反が汎用ハンドラに落ちて 500 になる。
        // 「Service で弾く」という設計をテストで固定しておく
        verify(followMapper, never()).insertIgnoreDuplicate(anyLong(), anyLong());
    }

    @Test
    @DisplayName("follow: フォローを登録し、登録後のフォロワー数と自分のフォロー状態を返す")
    void registersFollowAndReturnsStatus() {
        givenTargetExists();
        when(followMapper.countFollowers(TARGET_ID)).thenReturn(1);
        when(followMapper.exists(FOLLOWER_ID, TARGET_ID)).thenReturn(true);

        FollowStatusResponse response = followService.follow(FOLLOWER_ID, TARGET_USERNAME);

        verify(followMapper).insertIgnoreDuplicate(FOLLOWER_ID, TARGET_ID);
        assertThat(response.followerCount()).isEqualTo(1);
        assertThat(response.followedByMe()).isTrue();
    }

    @Test
    @DisplayName("unfollow: 相手が存在しなければ UserNotFoundException を投げ、削除しない")
    void unfollowThrowsWhenTargetUserNotFound() {
        when(userMapper.findByUsername(TARGET_USERNAME)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> followService.unfollow(FOLLOWER_ID, TARGET_USERNAME))
                .isInstanceOf(UserNotFoundException.class);

        verify(followMapper, never()).delete(anyLong(), anyLong());
    }

    @Test
    @DisplayName("unfollow: フォローしていない相手でも例外にせず、現在の状態を返す（冪等）")
    void unfollowIsIdempotent() {
        givenTargetExists();
        when(followMapper.countFollowers(TARGET_ID)).thenReturn(0);
        when(followMapper.exists(FOLLOWER_ID, TARGET_ID)).thenReturn(false);

        FollowStatusResponse response = followService.unfollow(FOLLOWER_ID, TARGET_USERNAME);

        verify(followMapper).delete(FOLLOWER_ID, TARGET_ID);
        assertThat(response.followerCount()).isZero();
        assertThat(response.followedByMe()).isFalse();
    }

    @Test
    @DisplayName("unfollow: 自分自身に対しては例外にしない（解除は0件削除で無害なため）")
    void unfollowDoesNotRejectSelf() {
        when(userMapper.findByUsername(TARGET_USERNAME))
                .thenReturn(Optional.of(user(FOLLOWER_ID, TARGET_USERNAME)));
        when(followMapper.countFollowers(FOLLOWER_ID)).thenReturn(0);
        when(followMapper.exists(FOLLOWER_ID, FOLLOWER_ID)).thenReturn(false);

        // follow とは違い、unfollow に自己チェックが無いことを意図的に確認する。
        // 解除は存在しない行を消すだけで害が無く、CHECK 制約にも触れないため
        assertThat(followService.unfollow(FOLLOWER_ID, TARGET_USERNAME).followedByMe()).isFalse();
    }

    @Test
    @DisplayName("getFollowing: ユーザーが存在しなければ UserNotFoundException を投げ、一覧を取りに行かない")
    void getFollowingThrowsWhenUserNotFound() {
        when(userMapper.findByUsername(TARGET_USERNAME)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> followService.getFollowing(TARGET_USERNAME, FOLLOWER_ID))
                .isInstanceOf(UserNotFoundException.class);

        verify(followMapper, never()).selectFollowing(anyLong(), anyLong());
    }

    @Test
    @DisplayName("getFollowers: ユーザーが存在しなければ UserNotFoundException を投げる")
    void getFollowersThrowsWhenUserNotFound() {
        when(userMapper.findByUsername(TARGET_USERNAME)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> followService.getFollowers(TARGET_USERNAME, FOLLOWER_ID))
                .isInstanceOf(UserNotFoundException.class);

        verify(followMapper, never()).selectFollowers(anyLong(), anyLong());
    }

    @Test
    @DisplayName("getFollowing: アイコンの保存パスを公開URLに変換して返す")
    void convertsIconPathToPublicUrl() {
        givenTargetExists();
        when(followMapper.selectFollowing(TARGET_ID, FOLLOWER_ID))
                .thenReturn(List.of(followUserDetail("icons/abc.jpg")));
        when(storageService.toPublicUrl("icons/abc.jpg")).thenReturn("/uploads/icons/abc.jpg");

        List<FollowUserResponse> following = followService.getFollowing(TARGET_USERNAME, FOLLOWER_ID);

        assertThat(following).singleElement()
                .extracting(FollowUserResponse::iconImageUrl)
                .isEqualTo("/uploads/icons/abc.jpg");
    }

    @Test
    @DisplayName("getFollowing: アイコンが未設定なら URL は null にし、変換処理そのものを呼ばない")
    void skipsUrlConversionWhenIconIsNotSet() {
        givenTargetExists();
        when(followMapper.selectFollowing(TARGET_ID, FOLLOWER_ID))
                .thenReturn(List.of(followUserDetail(null)));

        List<FollowUserResponse> following = followService.getFollowing(TARGET_USERNAME, FOLLOWER_ID);

        assertThat(following).singleElement().extracting(FollowUserResponse::iconImageUrl).isNull();
        verify(storageService, never()).toPublicUrl(any());
    }

    @Test
    @DisplayName("getFollowers: 誰にもフォローされていなければ空のリストを返す")
    void returnsEmptyListWhenNoFollowers() {
        givenTargetExists();
        when(followMapper.selectFollowers(TARGET_ID, FOLLOWER_ID)).thenReturn(List.of());

        assertThat(followService.getFollowers(TARGET_USERNAME, FOLLOWER_ID)).isEmpty();
    }
}
