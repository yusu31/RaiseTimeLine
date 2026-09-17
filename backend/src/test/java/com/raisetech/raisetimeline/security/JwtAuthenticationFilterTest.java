package com.raisetech.raisetimeline.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.MDC;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;

/**
 * {@link JwtAuthenticationFilter} が、トークンの状態に応じて
 * 「認証情報とMDCのuserIdを積む／WARNを出す／何もしない」を正しく使い分けることを確認する。
 *
 * <p>ログ設計上の要点は次の2つで、どちらも「出ること」と「出ないこと」の両方を固定する。
 * <ul>
 *   <li>トークン無し（未ログインの通常アクセス）は日常的なので<strong>ログを出さない</strong>。
 *       出すと本当に見るべき警告がノイズに埋もれる</li>
 *   <li>トークン有りだが無効はWARNを出す。ただしトークン本体は<strong>絶対に出さない</strong>
 *       （期限切れ直後の正規トークンがログに残ると、ログの閲覧者が成りすませる）</li>
 * </ul>
 *
 * <p>{@code doFilterInternal} を直接呼ぶ理由は {@code RequestIdFilterTest} と同じ。
 */
@ExtendWith({MockitoExtension.class, OutputCaptureExtension.class})
class JwtAuthenticationFilterTest {

    private static final String VALID_TOKEN = "valid.jwt.token";
    private static final String INVALID_TOKEN = "broken.jwt.token";

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    @Mock
    private FilterChain filterChain;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @AfterEach
    void clearSecurityContext() {
        // SecurityContextHolder はスレッドに紐づく共有状態。テスト間で認証情報が漏れないよう毎回消す
        SecurityContextHolder.clearContext();
    }

    private JwtAuthenticationFilter filter() {
        return new JwtAuthenticationFilter(jwtTokenProvider);
    }

    @Test
    void 有効なトークンならリクエスト処理中はMDCにuserIdが積まれる() throws Exception {
        when(request.getHeader("Authorization")).thenReturn("Bearer " + VALID_TOKEN);
        when(jwtTokenProvider.validateAndGetUser(VALID_TOKEN))
                .thenReturn(Optional.of(new AuthenticatedUser(42L, "suzuki@example.com", "鈴木")));
        doAnswer(invocation -> {
            assertThat(MDC.get("userId")).isEqualTo("42");
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
            return null;
        }).when(filterChain).doFilter(request, response);

        filter().doFilterInternal(request, response, filterChain);
    }

    @Test
    void リクエスト処理後はMDCのuserIdがクリアされる() throws Exception {
        when(request.getHeader("Authorization")).thenReturn("Bearer " + VALID_TOKEN);
        when(jwtTokenProvider.validateAndGetUser(VALID_TOKEN))
                .thenReturn(Optional.of(new AuthenticatedUser(42L, "suzuki@example.com", "鈴木")));

        filter().doFilterInternal(request, response, filterChain);

        // 消し忘れると、スレッドが使い回されたときに別人のリクエストへuserIdが混入する
        assertThat(MDC.get("userId")).isNull();
    }

    @Test
    void 無効なトークンならWARNを出すがトークン本体は出さない(CapturedOutput output) throws Exception {
        when(request.getHeader("Authorization")).thenReturn("Bearer " + INVALID_TOKEN);
        when(request.getRequestURI()).thenReturn("/api/posts");
        when(jwtTokenProvider.validateAndGetUser(INVALID_TOKEN)).thenReturn(Optional.empty());

        filter().doFilterInternal(request, response, filterChain);

        assertThat(output).contains("WARN");
        assertThat(output).contains("JWTの検証に失敗しました");
        assertThat(output).contains("/api/posts");
        assertThat(output).doesNotContain(INVALID_TOKEN);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void トークン無しならログを出さず認証情報も積まない(CapturedOutput output) throws Exception {
        when(request.getHeader("Authorization")).thenReturn(null);

        filter().doFilterInternal(request, response, filterChain);

        assertThat(output).doesNotContain("JWTの検証に失敗しました");
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        assertThat(MDC.get("userId")).isNull();
    }
}
