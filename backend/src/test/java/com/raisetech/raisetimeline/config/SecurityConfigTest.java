package com.raisetech.raisetimeline.config;

import com.raisetech.raisetimeline.logging.RequestIdFilter;
import com.raisetech.raisetimeline.security.JsonAccessDeniedHandler;
import com.raisetech.raisetimeline.security.JsonAuthenticationEntryPoint;
import com.raisetech.raisetimeline.security.JwtAuthenticationFilter;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class SecurityConfigTest {

    private final SecurityConfig securityConfig = new SecurityConfig(
            mock(RequestIdFilter.class),
            mock(JwtAuthenticationFilter.class),
            mock(JsonAuthenticationEntryPoint.class),
            mock(JsonAccessDeniedHandler.class)
    );

    @Test
    void 単一オリジンが許可リストに入る() {
        CorsConfigurationSource source = securityConfig.corsConfigurationSource("http://localhost:5173");
        CorsConfiguration config = source.getCorsConfiguration(new MockHttpServletRequest());

        assertThat(config.getAllowedOrigins()).containsExactly("http://localhost:5173");
    }

    @Test
    void カンマ区切りの複数オリジンが両方許可リストに入る() {
        CorsConfigurationSource source = securityConfig.corsConfigurationSource(
                "http://localhost:5173,https://example.cloudfront.net");
        CorsConfiguration config = source.getCorsConfiguration(new MockHttpServletRequest());

        assertThat(config.getAllowedOrigins())
                .containsExactly("http://localhost:5173", "https://example.cloudfront.net");
    }
}
