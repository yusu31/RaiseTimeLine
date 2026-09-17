package com.raisetech.raisetimeline.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    private static final String BEARER_PREFIX = "Bearer ";

    /** MDCのキー。以降の全ログ行に「誰の操作か」を自動で載せるために使う。ログパターン（application.yml）と一致させる */
    static final String MDC_USER_ID_KEY = "userId";

    private final JwtTokenProvider jwtTokenProvider;

    public JwtAuthenticationFilter(JwtTokenProvider jwtTokenProvider) {
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        // 「トークン無し」と「トークン有りだが無効」を区別するため、関数チェーンではなくif文で書く。
        // 前者は未ログインの通常アクセスなのでログを出さない（出すとノイズになる）。
        // 後者は期限切れ・改ざん・別環境の鍵で署名されたトークン等、運用上のシグナルなのでWARNを出す
        Optional<String> token = extractToken(request);
        if (token.isPresent()) {
            Optional<AuthenticatedUser> user = jwtTokenProvider.validateAndGetUser(token.get());
            if (user.isPresent()) {
                MDC.put(MDC_USER_ID_KEY, String.valueOf(user.get().id()));
                var authentication = new UsernamePasswordAuthenticationToken(user.get(), null, List.of());
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } else {
                // トークン本体は絶対に出さない。期限切れ直後の正規トークンがログに残ると成りすましに使える
                log.warn("JWTの検証に失敗しました: path={}", request.getRequestURI());
            }
        }
        try {
            filterChain.doFilter(request, response);
        } finally {
            // スレッドは使い回されるため、消し忘れると別人のリクエストのログにuserIdが混入する
            MDC.remove(MDC_USER_ID_KEY);
        }
    }

    private Optional<String> extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith(BEARER_PREFIX)) {
            return Optional.of(header.substring(BEARER_PREFIX.length()));
        }
        return Optional.empty();
    }
}
