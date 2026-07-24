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
class CommentControllerIntegrationTest {

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
    void 認証なしでコメント一覧取得も投稿も401が返る() throws Exception {
        mockMvc.perform(get("/api/posts/1/comments"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/posts/1/comments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"コメント"}
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 存在しない投稿へのコメント一覧取得と投稿は404が返る() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        mockMvc.perform(get("/api/posts/999/comments")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isNotFound());

        mockMvc.perform(post("/api/posts/999/comments")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"存在しない投稿へのコメント"}
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    void 空文字と281文字のコメントは400が返る() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        long postId = createPost(accessToken, "投稿本文");

        mockMvc.perform(post("/api/posts/{postId}/comments", postId)
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":""}
                                """))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/posts/{postId}/comments", postId)
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"" + "あ".repeat(281) + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 第三者の投稿にもコメントでき一覧に古い順で反映されタイムラインのcommentCountも増える() throws Exception {
        String ownerToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        String otherToken = signupAndGetAccessToken("takahashi@example.com", "高橋");
        long postId = createPost(ownerToken, "鈴木さんの投稿");

        mockMvc.perform(post("/api/posts/{postId}/comments", postId)
                        .header("Authorization", "Bearer " + otherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"1件目のコメント"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.content").value("1件目のコメント"))
                .andExpect(jsonPath("$.author.displayName").value("高橋"));

        mockMvc.perform(post("/api/posts/{postId}/comments", postId)
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"2件目のコメント"}
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/posts/{postId}/comments", postId)
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].content").value("1件目のコメント"))
                .andExpect(jsonPath("$[1].content").value("2件目のコメント"));

        mockMvc.perform(get("/api/posts/{id}", postId)
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.commentCount").value(2));
    }

    @Test
    void 本人はコメントを削除でき一覧から消える() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        long postId = createPost(accessToken, "投稿本文");
        String commentResponse = mockMvc.perform(post("/api/posts/{postId}/comments", postId)
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"削除するコメント"}
                                """))
                .andReturn().getResponse().getContentAsString();
        long commentId = objectMapper.readTree(commentResponse).get("id").asLong();

        mockMvc.perform(delete("/api/comments/{commentId}", commentId)
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/posts/{postId}/comments", postId)
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void 他人のコメントは削除できず403が返る_投稿主であっても消せない() throws Exception {
        String postOwnerToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        String commentOwnerToken = signupAndGetAccessToken("takahashi@example.com", "高橋");
        long postId = createPost(postOwnerToken, "鈴木さんの投稿");
        String commentResponse = mockMvc.perform(post("/api/posts/{postId}/comments", postId)
                        .header("Authorization", "Bearer " + commentOwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"高橋さんのコメント"}
                                """))
                .andReturn().getResponse().getContentAsString();
        long commentId = objectMapper.readTree(commentResponse).get("id").asLong();

        // 投稿主(鈴木)であっても他人(高橋)のコメントは削除できない
        mockMvc.perform(delete("/api/comments/{commentId}", commentId)
                        .header("Authorization", "Bearer " + postOwnerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void 存在しないコメントの削除は404が返る() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        mockMvc.perform(delete("/api/comments/999")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void 投稿削除で紐づくコメントも連動削除される() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        long postId = createPost(accessToken, "投稿本文");
        mockMvc.perform(post("/api/posts/{postId}/comments", postId)
                .header("Authorization", "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"content":"投稿削除で消えるはずのコメント"}
                        """));

        mockMvc.perform(delete("/api/posts/{id}", postId)
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk());

        Integer remaining = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM comments WHERE post_id = ?", Integer.class, postId);
        org.junit.jupiter.api.Assertions.assertEquals(0, remaining);
    }
}
