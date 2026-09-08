package com.raisetech.raisetimeline.service;

import com.raisetech.raisetimeline.config.JwtProperties;
import com.raisetech.raisetimeline.domain.RefreshToken;
import com.raisetech.raisetimeline.domain.User;
import com.raisetech.raisetimeline.exception.EmailAlreadyExistsException;
import com.raisetech.raisetimeline.exception.InvalidCredentialsException;
import com.raisetech.raisetimeline.exception.InvalidRefreshTokenException;
import com.raisetech.raisetimeline.exception.UsernameAlreadyExistsException;
import com.raisetech.raisetimeline.mapper.RefreshTokenMapper;
import com.raisetech.raisetimeline.mapper.UserMapper;
import com.raisetech.raisetimeline.request.LoginRequest;
import com.raisetech.raisetimeline.request.SignupRequest;
import com.raisetech.raisetimeline.response.AuthResponse;
import com.raisetech.raisetimeline.security.AuthenticatedUser;
import com.raisetech.raisetimeline.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link AuthService} のテスト。
 *
 * <p>認証は「間違ったときに何を返さないか」が特に重要になる。
 * ログイン失敗のメッセージが「そのメールアドレスは存在しません」だと、
 * 攻撃者に<strong>どのメールアドレスが登録済みかを教えてしまう</strong>。
 * メールが無い場合とパスワードが違う場合で、同じ文言を返すことをテストで固定する。</p>
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final long USER_ID = 10L;
    private static final String RAW_PASSWORD = "password123";
    private static final String HASHED_PASSWORD = "$2a$10$hashed";

    @Mock
    private UserMapper userMapper;

    @Mock
    private RefreshTokenMapper refreshTokenMapper;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private StorageService storageService;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        // JwtProperties は record（ただの値の入れ物）なので、モックにせず本物を作る。
        // 値を持つだけのものをモックにすると、かえって読みにくくなるため
        JwtProperties jwtProperties = new JwtProperties(
                "test-only-secret-key-for-jwt-signing-32chars",
                Duration.ofMinutes(30),
                Duration.ofDays(14));
        authService = new AuthService(userMapper, refreshTokenMapper, passwordEncoder,
                jwtTokenProvider, jwtProperties, storageService);
    }

    private SignupRequest signupRequest() {
        return new SignupRequest("suzuki@example.com", "suzuki", "鈴木", RAW_PASSWORD);
    }

    private User existingUser(String iconImagePath) {
        User user = new User();
        user.setId(USER_ID);
        user.setEmail("suzuki@example.com");
        user.setUsername("suzuki");
        user.setDisplayName("鈴木");
        user.setPasswordHash(HASHED_PASSWORD);
        user.setIconImagePath(iconImagePath);
        return user;
    }

    private void givenTokenIssued() {
        when(jwtTokenProvider.generateAccessToken(any(AuthenticatedUser.class))).thenReturn("access-token");
    }

    @Nested
    @DisplayName("新規登録")
    class Signup {

        @Test
        @DisplayName("メールアドレスが登録済みなら EmailAlreadyExistsException を投げ、ユーザーを作らない")
        void rejectsDuplicatedEmail() {
            when(userMapper.existsByEmail("suzuki@example.com")).thenReturn(true);

            assertThatThrownBy(() -> authService.signup(signupRequest()))
                    .isInstanceOf(EmailAlreadyExistsException.class);

            verify(userMapper, never()).insert(any());
        }

        @Test
        @DisplayName("@ユーザー名が使用済みなら UsernameAlreadyExistsException を投げ、ユーザーを作らない")
        void rejectsDuplicatedUsername() {
            when(userMapper.existsByEmail(anyString())).thenReturn(false);
            when(userMapper.existsByUsername("suzuki")).thenReturn(true);

            assertThatThrownBy(() -> authService.signup(signupRequest()))
                    .isInstanceOf(UsernameAlreadyExistsException.class);

            verify(userMapper, never()).insert(any());
        }

        @Test
        @DisplayName("パスワードはハッシュ化して保存し、入力された文字列そのものは保存しない")
        void storesHashedPasswordNotRawPassword() {
            when(userMapper.existsByEmail(anyString())).thenReturn(false);
            when(userMapper.existsByUsername(anyString())).thenReturn(false);
            when(passwordEncoder.encode(RAW_PASSWORD)).thenReturn(HASHED_PASSWORD);
            givenTokenIssued();

            authService.signup(signupRequest());

            ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
            verify(userMapper).insert(captor.capture());
            // 「ハッシュが入っている」だけでなく「生のパスワードが入っていない」ことも確かめる。
            // DBが漏れたときの被害の大きさが決定的に変わる部分
            assertThat(captor.getValue().getPasswordHash()).isEqualTo(HASHED_PASSWORD);
            assertThat(captor.getValue().getPasswordHash()).isNotEqualTo(RAW_PASSWORD);
        }

        @Test
        @DisplayName("登録に成功するとアクセストークンとリフレッシュトークンを発行する")
        void issuesBothTokens() {
            when(userMapper.existsByEmail(anyString())).thenReturn(false);
            when(userMapper.existsByUsername(anyString())).thenReturn(false);
            when(passwordEncoder.encode(anyString())).thenReturn(HASHED_PASSWORD);
            givenTokenIssued();

            AuthResponse response = authService.signup(signupRequest());

            assertThat(response.accessToken()).isEqualTo("access-token");
            assertThat(response.refreshToken()).isNotBlank();
            verify(refreshTokenMapper).insert(any(RefreshToken.class));
        }

        @Test
        @DisplayName("リフレッシュトークンには設定どおりの有効期限（14日）を設定する")
        void setsRefreshTokenExpiryFromProperties() {
            when(userMapper.existsByEmail(anyString())).thenReturn(false);
            when(userMapper.existsByUsername(anyString())).thenReturn(false);
            when(passwordEncoder.encode(anyString())).thenReturn(HASHED_PASSWORD);
            givenTokenIssued();

            authService.signup(signupRequest());

            ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
            verify(refreshTokenMapper).insert(captor.capture());
            // 実行時刻に依存するため「ちょうど14日後」ではなく、13日後より後・15日後より前で判定する
            assertThat(captor.getValue().getExpiresAt())
                    .isAfter(LocalDateTime.now().plusDays(13))
                    .isBefore(LocalDateTime.now().plusDays(15));
        }
    }

    @Nested
    @DisplayName("ログイン")
    class Login {

        @Test
        @DisplayName("メールアドレスが未登録なら InvalidCredentialsException を投げる")
        void rejectsUnknownEmail() {
            when(userMapper.findByEmail("suzuki@example.com")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> authService.login(new LoginRequest("suzuki@example.com", RAW_PASSWORD)))
                    .isInstanceOf(InvalidCredentialsException.class);
        }

        @Test
        @DisplayName("パスワードが違えば InvalidCredentialsException を投げ、トークンを発行しない")
        void rejectsWrongPassword() {
            when(userMapper.findByEmail(anyString())).thenReturn(Optional.of(existingUser(null)));
            when(passwordEncoder.matches("wrong", HASHED_PASSWORD)).thenReturn(false);

            assertThatThrownBy(() -> authService.login(new LoginRequest("suzuki@example.com", "wrong")))
                    .isInstanceOf(InvalidCredentialsException.class);

            verify(jwtTokenProvider, never()).generateAccessToken(any());
        }

        @Test
        @DisplayName("メール未登録とパスワード誤りで、同じメッセージを返す（登録済みかどうかを教えないため）")
        void doesNotRevealWhichPartIsWrong() {
            when(userMapper.findByEmail("unknown@example.com")).thenReturn(Optional.empty());
            when(userMapper.findByEmail("suzuki@example.com")).thenReturn(Optional.of(existingUser(null)));
            when(passwordEncoder.matches("wrong", HASHED_PASSWORD)).thenReturn(false);

            String unknownEmailMessage = catchMessage(() ->
                    authService.login(new LoginRequest("unknown@example.com", RAW_PASSWORD)));
            String wrongPasswordMessage = catchMessage(() ->
                    authService.login(new LoginRequest("suzuki@example.com", "wrong")));

            assertThat(unknownEmailMessage).isEqualTo(wrongPasswordMessage);
        }

        private String catchMessage(Runnable action) {
            try {
                action.run();
                throw new AssertionError("例外が発生しませんでした");
            } catch (InvalidCredentialsException e) {
                return e.getMessage();
            }
        }

        @Test
        @DisplayName("パスワードが正しければトークンを発行する")
        void issuesTokensOnSuccess() {
            when(userMapper.findByEmail(anyString())).thenReturn(Optional.of(existingUser(null)));
            when(passwordEncoder.matches(RAW_PASSWORD, HASHED_PASSWORD)).thenReturn(true);
            givenTokenIssued();

            AuthResponse response = authService.login(new LoginRequest("suzuki@example.com", RAW_PASSWORD));

            assertThat(response.accessToken()).isEqualTo("access-token");
            assertThat(response.user().username()).isEqualTo("suzuki");
        }

        @Test
        @DisplayName("アイコンが未設定なら URL は null にし、変換処理そのものを呼ばない")
        void skipsIconUrlConversionWhenNotSet() {
            when(userMapper.findByEmail(anyString())).thenReturn(Optional.of(existingUser(null)));
            when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);
            givenTokenIssued();

            AuthResponse response = authService.login(new LoginRequest("suzuki@example.com", RAW_PASSWORD));

            assertThat(response.user().iconImageUrl()).isNull();
            verify(storageService, never()).toPublicUrl(any());
        }
    }

    @Nested
    @DisplayName("トークンの更新（refresh）")
    class Refresh {

        private RefreshToken refreshToken(LocalDateTime expiresAt) {
            RefreshToken token = new RefreshToken();
            token.setUserId(USER_ID);
            token.setToken("refresh-token");
            token.setExpiresAt(expiresAt);
            return token;
        }

        @Test
        @DisplayName("トークンが存在しなければ InvalidRefreshTokenException を投げる")
        void rejectsUnknownToken() {
            when(refreshTokenMapper.findByToken("refresh-token")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> authService.refresh("refresh-token"))
                    .isInstanceOf(InvalidRefreshTokenException.class);
        }

        @Test
        @DisplayName("有効期限が切れていれば例外を投げ、そのトークンをDBから削除する")
        void deletesExpiredToken() {
            when(refreshTokenMapper.findByToken("refresh-token"))
                    .thenReturn(Optional.of(refreshToken(LocalDateTime.now().minusSeconds(1))));

            assertThatThrownBy(() -> authService.refresh("refresh-token"))
                    .isInstanceOf(InvalidRefreshTokenException.class);

            // 期限切れのトークンを残すと、DBに使えない行が溜まり続ける
            verify(refreshTokenMapper).deleteByToken("refresh-token");
        }

        @Test
        @DisplayName("有効期限内なら新しいアクセストークンを発行し、リフレッシュトークンは消さない")
        void issuesNewAccessTokenWhenValid() {
            when(refreshTokenMapper.findByToken("refresh-token"))
                    .thenReturn(Optional.of(refreshToken(LocalDateTime.now().plusDays(1))));
            when(userMapper.findById(USER_ID)).thenReturn(Optional.of(existingUser(null)));
            givenTokenIssued();

            assertThat(authService.refresh("refresh-token").accessToken()).isEqualTo("access-token");

            // 使い回せなくなるとログイン状態がすぐ切れてしまうため、消してはいけない
            verify(refreshTokenMapper, never()).deleteByToken(anyString());
        }

        @Test
        @DisplayName("トークンは有効でも、ひもづくユーザーが消えていれば InvalidRefreshTokenException を投げる")
        void rejectsWhenUserNoLongerExists() {
            when(refreshTokenMapper.findByToken("refresh-token"))
                    .thenReturn(Optional.of(refreshToken(LocalDateTime.now().plusDays(1))));
            when(userMapper.findById(USER_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> authService.refresh("refresh-token"))
                    .isInstanceOf(InvalidRefreshTokenException.class);
        }
    }

    @Test
    @DisplayName("logout: リフレッシュトークンをDBから削除する（サーバー側でも無効にするため）")
    void logoutDeletesRefreshToken() {
        authService.logout("refresh-token");

        verify(refreshTokenMapper).deleteByToken("refresh-token");
    }

    @Test
    @DisplayName("logout: 存在しないトークンでも例外にしない（何度ログアウトしても安全にするため）")
    void logoutIsIdempotent() {
        authService.logout("存在しないトークン");

        verify(refreshTokenMapper).deleteByToken("存在しないトークン");
    }
}
