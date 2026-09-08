package com.raisetech.raisetimeline.service;

import com.raisetech.raisetimeline.domain.User;
import com.raisetech.raisetimeline.domain.UserProfileDetail;
import com.raisetech.raisetimeline.exception.UserNotFoundException;
import com.raisetech.raisetimeline.exception.UsernameAlreadyExistsException;
import com.raisetech.raisetimeline.mapper.UserMapper;
import com.raisetech.raisetimeline.request.ProfileUpdateRequest;
import com.raisetech.raisetimeline.response.UserProfileResponse;
import com.raisetech.raisetimeline.response.UserSearchResultResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link UserService} のテスト。
 *
 * <p>アイコンの差し替えでは<strong>処理の順序そのもの</strong>を確認している。
 * 「新しいファイルを保存 → DBを更新 → 古いファイルを削除」の順でないと、
 * DB更新に失敗したときに古いアイコンだけが失われ、画像が表示できなくなるため。</p>
 */
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    private static final long USER_ID = 10L;
    private static final String USERNAME = "suzuki";

    @Mock
    private UserMapper userMapper;

    @Mock
    private StorageService storageService;

    @Mock
    private SearchKeyword searchKeyword;

    @InjectMocks
    private UserService userService;

    private User user(String iconImagePath) {
        User user = new User();
        user.setId(USER_ID);
        user.setUsername(USERNAME);
        user.setDisplayName("鈴木");
        user.setEmail("suzuki@example.com");
        user.setIconImagePath(iconImagePath);
        return user;
    }

    private UserProfileDetail profileDetail(String iconImagePath) {
        UserProfileDetail detail = new UserProfileDetail();
        detail.setId(USER_ID);
        detail.setUsername(USERNAME);
        detail.setDisplayName("鈴木");
        detail.setBio("自己紹介");
        detail.setIconImagePath(iconImagePath);
        detail.setCreatedAt(LocalDateTime.of(2026, 9, 1, 12, 0));
        detail.setFollowingCount(3);
        detail.setFollowerCount(5);
        detail.setFollowedByMe(true);
        return detail;
    }

    @Nested
    @DisplayName("プロフィール取得")
    class GetProfile {

        @Test
        @DisplayName("ユーザーが存在しなければ UserNotFoundException を投げる")
        void throwsWhenUserNotFound() {
            when(userMapper.selectProfileByUsername(USERNAME, USER_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> userService.getProfile(USERNAME, USER_ID))
                    .isInstanceOf(UserNotFoundException.class);
        }

        @Test
        @DisplayName("フォロー数・フォロワー数・フォロー中フラグをそのまま返す")
        void returnsFollowCounts() {
            when(userMapper.selectProfileByUsername(USERNAME, USER_ID))
                    .thenReturn(Optional.of(profileDetail(null)));

            UserProfileResponse profile = userService.getProfile(USERNAME, USER_ID);

            assertThat(profile.followingCount()).isEqualTo(3);
            assertThat(profile.followerCount()).isEqualTo(5);
            assertThat(profile.followedByMe()).isTrue();
        }

        @Test
        @DisplayName("アイコンの保存パスは公開URLに変換して返す")
        void convertsIconPathToPublicUrl() {
            when(userMapper.selectProfileByUsername(USERNAME, USER_ID))
                    .thenReturn(Optional.of(profileDetail("icons/abc.jpg")));
            when(storageService.toPublicUrl("icons/abc.jpg")).thenReturn("/uploads/icons/abc.jpg");

            assertThat(userService.getProfile(USERNAME, USER_ID).iconImageUrl())
                    .isEqualTo("/uploads/icons/abc.jpg");
        }

        @Test
        @DisplayName("アイコンが未設定なら URL は null にし、変換処理そのものを呼ばない")
        void skipsUrlConversionWhenIconIsNotSet() {
            when(userMapper.selectProfileByUsername(USERNAME, USER_ID))
                    .thenReturn(Optional.of(profileDetail(null)));

            assertThat(userService.getProfile(USERNAME, USER_ID).iconImageUrl()).isNull();
            verify(storageService, never()).toPublicUrl(any());
        }
    }

    @Nested
    @DisplayName("ユーザー検索")
    class SearchUsers {

        @ParameterizedTest(name = "[{index}] キーワード \"{0}\" ではDBに問い合わせない")
        @NullSource
        @ValueSource(strings = {"", "   "})
        @DisplayName("空のキーワードならDBに問い合わせず、空のリストを返す")
        void doesNotQueryDatabaseForBlankKeyword(String keyword) {
            when(searchKeyword.normalize(keyword)).thenReturn("");

            assertThat(userService.searchUsers(keyword)).isEmpty();

            // 空文字で検索すると ILIKE '%%' が全ユーザーに一致してしまう。
            // 「問い合わせない」ことが仕様なので、そこを確認する
            verify(userMapper, never()).searchByKeyword(anyString());
        }

        @Test
        @DisplayName("キーワードはエスケープしてからDBに渡す")
        void passesEscapedKeywordToMapper() {
            when(searchKeyword.normalize("50%")).thenReturn("50\\%");
            when(userMapper.searchByKeyword("50\\%")).thenReturn(List.of());

            userService.searchUsers("50%");

            verify(userMapper).searchByKeyword("50\\%");
        }

        @Test
        @DisplayName("見つかったユーザーを検索結果の形に変換して返す")
        void convertsFoundUsers() {
            when(searchKeyword.normalize("鈴木")).thenReturn("鈴木");
            when(userMapper.searchByKeyword("鈴木")).thenReturn(List.of(user(null)));

            List<UserSearchResultResponse> results = userService.searchUsers("鈴木");

            assertThat(results).singleElement()
                    .extracting(UserSearchResultResponse::username)
                    .isEqualTo(USERNAME);
        }
    }

    @Nested
    @DisplayName("プロフィール更新")
    class UpdateProfile {

        private final ProfileUpdateRequest request = new ProfileUpdateRequest("新しい表示名", USERNAME, "新しい自己紹介");

        @Test
        @DisplayName("ユーザーが存在しなければ UserNotFoundException を投げ、更新しない")
        void throwsWhenUserNotFound() {
            when(userMapper.findById(USER_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> userService.updateProfile(USER_ID, request))
                    .isInstanceOf(UserNotFoundException.class);

            verify(userMapper, never()).updateProfile(anyLong(), anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("他人が使っている@ユーザー名なら UsernameAlreadyExistsException を投げ、更新しない")
        void throwsWhenUsernameIsTakenByOthers() {
            when(userMapper.findById(USER_ID)).thenReturn(Optional.of(user(null)));
            when(userMapper.existsByUsernameExcludingSelf(USERNAME, USER_ID)).thenReturn(true);

            assertThatThrownBy(() -> userService.updateProfile(USER_ID, request))
                    .isInstanceOf(UsernameAlreadyExistsException.class);

            verify(userMapper, never()).updateProfile(anyLong(), anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("@ユーザー名を変えずに保存できる（重複判定から自分自身を除外している）")
        void allowsKeepingOwnUsername() {
            when(userMapper.findById(USER_ID)).thenReturn(Optional.of(user(null)));
            // 自分自身を除外しているため、自分の名前は「使われている」と判定されない
            when(userMapper.existsByUsernameExcludingSelf(USERNAME, USER_ID)).thenReturn(false);

            userService.updateProfile(USER_ID, request);

            verify(userMapper).updateProfile(USER_ID, "新しい表示名", USERNAME, "新しい自己紹介");
        }
    }

    @Nested
    @DisplayName("アイコン更新")
    class UpdateIcon {

        private final MultipartFile image =
                new MockMultipartFile("image", "photo.jpg", "image/jpeg", "content".getBytes());

        @Test
        @DisplayName("ユーザーが存在しなければ UserNotFoundException を投げ、ファイルを保存しない")
        void throwsWhenUserNotFound() {
            when(userMapper.findById(USER_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> userService.updateIcon(USER_ID, image))
                    .isInstanceOf(UserNotFoundException.class);

            verify(storageService, never()).store(any());
        }

        @Test
        @DisplayName("「新ファイル保存 → DB更新 → 旧ファイル削除」の順で処理する")
        void followsSaveUpdateDeleteOrder() {
            when(userMapper.findById(USER_ID)).thenReturn(Optional.of(user("icons/old.jpg")));
            when(storageService.store(image)).thenReturn("icons/new.jpg");

            userService.updateIcon(USER_ID, image);

            // 順序が入れ替わり「旧削除 → DB更新」になると、DB更新が失敗したときに
            // アイコンだけが消えて復元できなくなる。順序そのものを固定する
            InOrder inOrder = inOrder(storageService, userMapper);
            inOrder.verify(storageService).store(image);
            inOrder.verify(userMapper).updateIconImagePath(USER_ID, "icons/new.jpg");
            inOrder.verify(storageService).delete("icons/old.jpg");
        }

        @Test
        @DisplayName("元々アイコンが無かった場合、削除処理は呼ばない")
        void doesNotDeleteWhenNoPreviousIcon() {
            when(userMapper.findById(USER_ID)).thenReturn(Optional.of(user(null)));
            when(storageService.store(image)).thenReturn("icons/new.jpg");

            userService.updateIcon(USER_ID, image);

            verify(storageService, never()).delete(any());
        }
    }

    @Test
    @DisplayName("findByUsernameOrThrow: ユーザーが存在しなければ UserNotFoundException を投げる")
    void findByUsernameOrThrowThrowsWhenNotFound() {
        when(userMapper.findByUsername(USERNAME)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.findByUsernameOrThrow(USERNAME))
                .isInstanceOf(UserNotFoundException.class);
    }
}
