package com.raisetech.raisetimeline.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultMatcher;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.time.Instant;
import java.util.TimeZone;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Issue #171: APIが返す日時は、サーバーの時計（タイムゾーン）に依存せず、
 * UTC を表す {@code Z} 付きの ISO-8601 でなければならない。
 * <p>
 * 「作った直後の投稿の createdAt が、現在時刻と1分以内にずれていること」を検証する。
 * {@code Z} 無しだと {@link Instant#parse} が失敗し、
 * 日本時間のまま保存・返却されると9時間ずれて失敗する。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DateTimeApiIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanDatabase() {
        jdbcTemplate.execute("TRUNCATE TABLE posts, comments, likes, refresh_tokens, users RESTART IDENTITY CASCADE");
    }

    /** JSONの文字列を UTC の Instant として読み、現在時刻から1分以内かを確かめる。 */
    private static ResultMatcher isUtcInstantJustNow(String jsonPath) {
        return result -> {
            String json = result.getResponse().getContentAsString();
            Object value = com.jayway.jsonpath.JsonPath.read(json, jsonPath);
            Instant createdAt = Instant.parse((String) value);
            assertThat(Duration.between(createdAt, Instant.now()).abs())
                    .as("%s=%s は現在時刻と1分以内であるべき", jsonPath, value)
                    .isLessThan(Duration.ofMinutes(1));
        };
    }

    private String signupAndGetAccessToken() throws Exception {
        String response = mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"suzuki@example.com","username":"suzuki","displayName":"鈴木","password":"password123"}
                                """))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("accessToken").asText();
    }

    private long createPost(String accessToken) throws Exception {
        String response = mockMvc.perform(multipart("/api/posts")
                        .param("content", "時刻の検証用")
                        .header("Authorization", "Bearer " + accessToken))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    @Test
    void JVMの既定タイムゾーンはUTCに固定されている() {
        assertThat(TimeZone.getDefault().getID()).isEqualTo("UTC");
    }

    @Test
    void 投稿のcreatedAtはZ付きUTCで返り作成直後は現在時刻と一致する() throws Exception {
        String token = signupAndGetAccessToken();
        long postId = createPost(token);

        mockMvc.perform(get("/api/posts/{id}", postId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(isUtcInstantJustNow("$.createdAt"));
    }

    @Test
    void コメントのcreatedAtはZ付きUTCで返り作成直後は現在時刻と一致する() throws Exception {
        String token = signupAndGetAccessToken();
        long postId = createPost(token);

        mockMvc.perform(post("/api/posts/{postId}/comments", postId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"コメント"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(isUtcInstantJustNow("$.createdAt"));
    }

    @Test
    void プロフィールのcreatedAtはZ付きUTCで返り登録直後は現在時刻と一致する() throws Exception {
        String token = signupAndGetAccessToken();

        mockMvc.perform(get("/api/users/{username}", "suzuki").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(isUtcInstantJustNow("$.createdAt"));
    }
}
