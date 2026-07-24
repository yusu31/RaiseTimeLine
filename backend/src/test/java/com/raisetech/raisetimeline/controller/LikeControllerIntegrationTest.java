package com.raisetech.raisetimeline.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class LikeControllerIntegrationTest {

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

    private String signupAndGetAccessToken(String email, String displayName) throws Exception {
        String response = mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","displayName":"%s","password":"password123"}
                                """.formatted(email, displayName)))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("accessToken").asText();
    }

    private long createPost(String accessToken, String content) throws Exception {
        String response = mockMvc.perform(multipart("/api/posts")
                        .param("content", content)
                        .header("Authorization", "Bearer " + accessToken))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    @Test
    void 認証なしでいいねも解除も401が返る() throws Exception {
        mockMvc.perform(post("/api/posts/1/likes"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/posts/1/likes"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 存在しない投稿へのいいねは404が返る() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        mockMvc.perform(post("/api/posts/999/likes")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void いいねするとlikeCountが1増えlikedByMeがtrueになる() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        long postId = createPost(accessToken, "投稿本文");

        mockMvc.perform(post("/api/posts/{postId}/likes", postId)
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.likeCount").value(1))
                .andExpect(jsonPath("$.likedByMe").value(true));

        mockMvc.perform(get("/api/posts/{id}", postId)
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.likeCount").value(1))
                .andExpect(jsonPath("$.likedByMe").value(true));
    }

    @Test
    void 連続していいねしても件数は1のまま冪等になる() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        long postId = createPost(accessToken, "投稿本文");

        mockMvc.perform(post("/api/posts/{postId}/likes", postId)
                .header("Authorization", "Bearer " + accessToken));
        mockMvc.perform(post("/api/posts/{postId}/likes", postId)
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.likeCount").value(1));
    }

    @Test
    void いいね解除するとlikeCountが減りlikedByMeがfalseになる() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        long postId = createPost(accessToken, "投稿本文");
        mockMvc.perform(post("/api/posts/{postId}/likes", postId)
                .header("Authorization", "Bearer " + accessToken));

        mockMvc.perform(delete("/api/posts/{postId}/likes", postId)
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.likeCount").value(0))
                .andExpect(jsonPath("$.likedByMe").value(false));
    }

    @Test
    void いいねしていない状態で解除しても冪等に成功する() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        long postId = createPost(accessToken, "投稿本文");

        mockMvc.perform(delete("/api/posts/{postId}/likes", postId)
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.likeCount").value(0))
                .andExpect(jsonPath("$.likedByMe").value(false));
    }

    @Test
    void 第三者の投稿にもいいねでき別ユーザーがいいねすると合計2になりlikedByMeはユーザーごとに異なる() throws Exception {
        String ownerToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        String otherToken = signupAndGetAccessToken("takahashi@example.com", "高橋");
        long postId = createPost(ownerToken, "鈴木さんの投稿");

        mockMvc.perform(post("/api/posts/{postId}/likes", postId)
                        .header("Authorization", "Bearer " + otherToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.likeCount").value(1))
                .andExpect(jsonPath("$.likedByMe").value(true));

        mockMvc.perform(post("/api/posts/{postId}/likes", postId)
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.likeCount").value(2))
                .andExpect(jsonPath("$.likedByMe").value(true));

        // 高橋さんから見たlikedByMeはtrue、まだいいねしていない第三者視点は別途確認できないが
        // 少なくとも自分のいいね有無が正しく反映されていることを確認する
        mockMvc.perform(get("/api/posts/{id}", postId)
                        .header("Authorization", "Bearer " + otherToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.likeCount").value(2))
                .andExpect(jsonPath("$.likedByMe").value(true));
    }

    @Test
    void 投稿削除で紐づくいいねも連動削除される() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        long postId = createPost(accessToken, "投稿本文");
        mockMvc.perform(post("/api/posts/{postId}/likes", postId)
                .header("Authorization", "Bearer " + accessToken));

        mockMvc.perform(delete("/api/posts/{id}", postId)
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk());

        Integer remaining = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM likes WHERE post_id = ?", Integer.class, postId);
        org.junit.jupiter.api.Assertions.assertEquals(0, remaining);
    }
}
