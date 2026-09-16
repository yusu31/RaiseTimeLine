package com.raisetech.raisetimeline.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.MDC;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;

/**
 * {@link RequestIdFilter} が、リクエストごとにMDCへ相関ID（requestId）を積み、
 * 処理後に必ず取り除くことを確認する。
 *
 * <p>{@code doFilterInternal} を直接呼び出す（{@code protected} だが同一パッケージのため可能）。
 * {@code doFilter} 経由だと {@link jakarta.servlet.Filter} の共通処理が挟まりモックの設定が
 * 煩雑になるため、フィルタ自身のロジックだけに焦点を絞る。
 */
@ExtendWith(MockitoExtension.class)
class RequestIdFilterTest {

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    @Mock
    private FilterChain filterChain;

    private final RequestIdFilter filter = new RequestIdFilter();

    @Test
    void リクエスト処理中はMDCにrequestIdが積まれる() throws Exception {
        doAnswer(invocation -> {
            assertThat(MDC.get("requestId")).isNotBlank();
            return null;
        }).when(filterChain).doFilter(request, response);

        filter.doFilterInternal(request, response, filterChain);
    }

    @Test
    void リクエスト処理後はMDCがクリアされる() throws Exception {
        filter.doFilterInternal(request, response, filterChain);

        assertThat(MDC.get("requestId")).isNull();
    }

    @Test
    void レスポンスヘッダーにXRequestIdが設定される() throws Exception {
        filter.doFilterInternal(request, response, filterChain);

        verify(response).setHeader(eq("X-Request-Id"), anyString());
    }
}
