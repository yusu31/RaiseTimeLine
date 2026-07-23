package com.raisetech.raisetimeline.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PostControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanDatabase() {
        jdbcTemplate.execute("TRUNCATE TABLE posts, refresh_tokens, users RESTART IDENTITY CASCADE");
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

    @Test
    void 認証なしで投稿一覧を取得すると401が返る() throws Exception {
        mockMvc.perform(get("/api/posts"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 本文のみの投稿作成は201で返り一覧にも反映される() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        mockMvc.perform(multipart("/api/posts")
                        .param("content", "はじめての投稿です")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.content").value("はじめての投稿です"))
                .andExpect(jsonPath("$.imageUrl").value(nullValue()))
                .andExpect(jsonPath("$.author.displayName").value("鈴木"));

        mockMvc.perform(get("/api/posts").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts[0].content").value("はじめての投稿です"))
                .andExpect(jsonPath("$.hasNext").value(false));
    }

    @Test
    void 本文が281文字だと400が返る() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        String tooLong = "あ".repeat(281);

        mockMvc.perform(multipart("/api/posts")
                        .param("content", tooLong)
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 本文が空文字だと400が返る() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        mockMvc.perform(multipart("/api/posts")
                        .param("content", "")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void JPEG画像付き投稿は201で返りimageUrlがuploadsパス形式になる() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        MockMultipartFile image = new MockMultipartFile("image", "photo.jpg", "image/jpeg", "dummy-image-bytes".getBytes());

        mockMvc.perform(multipart("/api/posts")
                        .file(image)
                        .param("content", "写真を撮りました")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.imageUrl").value(startsWith("/uploads/")));
    }

    @Test
    void 非対応形式の画像は400が返る() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        MockMultipartFile image = new MockMultipartFile("image", "photo.gif", "image/gif", "dummy".getBytes());

        mockMvc.perform(multipart("/api/posts")
                        .file(image)
                        .param("content", "非対応画像テスト")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 画像が5MBを超えると400が返る() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        byte[] tooLarge = new byte[6 * 1024 * 1024];
        MockMultipartFile image = new MockMultipartFile("image", "big.png", "image/png", tooLarge);

        mockMvc.perform(multipart("/api/posts")
                        .file(image)
                        .param("content", "大きすぎる画像テスト")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void ページネーションでhasNextがtrueからfalseに切り替わる() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        for (int i = 0; i < 21; i++) {
            mockMvc.perform(multipart("/api/posts")
                    .param("content", "投稿" + i)
                    .header("Authorization", "Bearer " + accessToken));
        }

        mockMvc.perform(get("/api/posts").param("page", "0").param("size", "20")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(20))
                .andExpect(jsonPath("$.hasNext").value(true));

        mockMvc.perform(get("/api/posts").param("page", "1").param("size", "20")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(1))
                .andExpect(jsonPath("$.hasNext").value(false));
    }

    @Test
    void 存在しない投稿の詳細取得は404が返る() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        mockMvc.perform(get("/api/posts/999").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void 自分の投稿は編集も削除もできる() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        String createResponse = mockMvc.perform(multipart("/api/posts")
                        .param("content", "編集前の本文")
                        .header("Authorization", "Bearer " + accessToken))
                .andReturn().getResponse().getContentAsString();
        long postId = objectMapper.readTree(createResponse).get("id").asLong();

        mockMvc.perform(put("/api/posts/{id}", postId)
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"編集後の本文"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("編集後の本文"));

        mockMvc.perform(delete("/api/posts/{id}", postId)
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/posts/{id}", postId)
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void 他人の投稿は編集も削除も403が返る() throws Exception {
        String ownerToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        String otherToken = signupAndGetAccessToken("takahashi@example.com", "高橋");

        String createResponse = mockMvc.perform(multipart("/api/posts")
                        .param("content", "鈴木さんの投稿")
                        .header("Authorization", "Bearer " + ownerToken))
                .andReturn().getResponse().getContentAsString();
        long postId = objectMapper.readTree(createResponse).get("id").asLong();

        mockMvc.perform(put("/api/posts/{id}", postId)
                        .header("Authorization", "Bearer " + otherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"高橋さんが勝手に編集"}
                                """))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/posts/{id}", postId)
                        .header("Authorization", "Bearer " + otherToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void 存在しない投稿の編集削除は404が返る() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        mockMvc.perform(put("/api/posts/999")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"存在しない投稿"}
                                """))
                .andExpect(status().isNotFound());

        mockMvc.perform(delete("/api/posts/999")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isNotFound());
    }
}
