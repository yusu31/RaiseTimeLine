package com.raisetech.raisetimeline.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * リクエストごとに相関ID（requestId）を発行し、以降のログ行すべてに自動で乗せる。
 *
 * <p>複数のユーザーが同時にアクセスすると、ログはリクエストをまたいで時系列に混ざって
 * 出力される。障害対応でどのログ行がどのリクエストの続きかを追う唯一の手掛かりが
 * このIDになる。MDC（{@link org.slf4j.MDC}）はスレッドローカルな変数で、
 * Tomcatはリクエストごとにスレッドを使い回すため、{@code finally} でのクリアを怠ると
 * 別のリクエストのログに前のリクエストのIDが紛れ込む（発見しづらいバグになる）。
 *
 * <p>IDは常にサーバー側で生成する。クライアントが送ってきたヘッダーをそのまま
 * 相関キーとして信用すると、ログの内容を外部から偽装される入口になるため。
 */
@Component
public class RequestIdFilter extends OncePerRequestFilter {

    private static final String MDC_KEY = "requestId";
    private static final String RESPONSE_HEADER = "X-Request-Id";

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        String requestId = UUID.randomUUID().toString();
        MDC.put(MDC_KEY, requestId);
        response.setHeader(RESPONSE_HEADER, requestId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }
}
