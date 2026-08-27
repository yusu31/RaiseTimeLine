package com.raisetech.raisetimeline.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class FollowControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanDatabase() {
        jdbcTemplate.execute(
                "TRUNCATE TABLE posts, comments, likes, follows, refresh_tokens, users RESTART IDENTITY CASCADE");
    }

    private String signupAndGetAccessToken(String email, String displayName) throws Exception {
        String username = email.substring(0, email.indexOf('@'));
        String response = mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","username":"%s","displayName":"%s","password":"password123"}
                                """.formatted(email, username, displayName)))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("accessToken").asText();
    }

    private void createPost(String accessToken, String content) throws Exception {
        mockMvc.perform(multipart("/api/posts")
                .param("content", content)
                .header("Authorization", "Bearer " + accessToken));
    }

    private void follow(String accessToken, String targetUsername) throws Exception {
        mockMvc.perform(post("/api/users/{username}/follow", targetUsername)
                .header("Authorization", "Bearer " + accessToken));
    }

    @Test
    void 認証なしでフォローも解除も401が返る() throws Exception {
        mockMvc.perform(post("/api/users/suzuki/follow"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/users/suzuki/follow"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 存在しないユーザーへのフォローは404が返る() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        mockMvc.perform(post("/api/users/{username}/follow", "nobody")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isNotFound());
    }

    /**
     * DBのCHECK制約(23514)はON CONFLICT DO NOTHING(23505のみ対象)では無害化されず500になる。
     * Service層で先に弾いて400を返せていることを確認する。
     */
    @Test
    void 自分自身をフォローすると400が返る() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        mockMvc.perform(post("/api/users/{username}/follow", "suzuki")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isBadRequest());

        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM follows", Integer.class);
        Assertions.assertEquals(0, count);
    }

    @Test
    void フォローするとfollowerCountが1増えfollowedByMeがtrueになる() throws Exception {
        String suzukiToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        signupAndGetAccessToken("takahashi@example.com", "高橋");

        mockMvc.perform(post("/api/users/{username}/follow", "takahashi")
                        .header("Authorization", "Bearer " + suzukiToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.followerCount").value(1))
                .andExpect(jsonPath("$.followedByMe").value(true));
    }

    @Test
    void 連続してフォローしてもDBは1行のまま冪等になる() throws Exception {
        String suzukiToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        signupAndGetAccessToken("takahashi@example.com", "高橋");

        follow(suzukiToken, "takahashi");
        mockMvc.perform(post("/api/users/{username}/follow", "takahashi")
                        .header("Authorization", "Bearer " + suzukiToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.followerCount").value(1));

        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM follows", Integer.class);
        Assertions.assertEquals(1, count);
    }

    @Test
    void フォロー解除するとfollowerCountが減りfollowedByMeがfalseになる() throws Exception {
        String suzukiToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        signupAndGetAccessToken("takahashi@example.com", "高橋");
        follow(suzukiToken, "takahashi");

        mockMvc.perform(delete("/api/users/{username}/follow", "takahashi")
                        .header("Authorization", "Bearer " + suzukiToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.followerCount").value(0))
                .andExpect(jsonPath("$.followedByMe").value(false));
    }

    @Test
    void フォローしていない状態で解除しても冪等に成功する() throws Exception {
        String suzukiToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        signupAndGetAccessToken("takahashi@example.com", "高橋");

        mockMvc.perform(delete("/api/users/{username}/follow", "takahashi")
                        .header("Authorization", "Bearer " + suzukiToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.followerCount").value(0))
                .andExpect(jsonPath("$.followedByMe").value(false));
    }

    @Test
    void フォロー中一覧とフォロワー一覧が正しい集合を返す() throws Exception {
        String suzukiToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        signupAndGetAccessToken("takahashi@example.com", "高橋");
        signupAndGetAccessToken("tanaka@example.com", "田中");

        follow(suzukiToken, "takahashi");
        follow(suzukiToken, "tanaka");

        // 鈴木がフォローしているのは高橋と田中の2人
        mockMvc.perform(get("/api/users/{username}/following", "suzuki")
                        .header("Authorization", "Bearer " + suzukiToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[*].username").value(org.hamcrest.Matchers.containsInAnyOrder("tanaka", "takahashi")))
                .andExpect(jsonPath("$[0].followedByMe").value(true));

        // 高橋のフォロワーは鈴木だけ
        mockMvc.perform(get("/api/users/{username}/followers", "takahashi")
                        .header("Authorization", "Bearer " + suzukiToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].username").value("suzuki"));

        // 鈴木にはフォロワーがいない
        mockMvc.perform(get("/api/users/{username}/followers", "suzuki")
                        .header("Authorization", "Bearer " + suzukiToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void プロフィールにフォロー数とフォロー中フラグが反映される() throws Exception {
        String suzukiToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        String takahashiToken = signupAndGetAccessToken("takahashi@example.com", "高橋");
        follow(suzukiToken, "takahashi");

        // 鈴木から見た高橋のプロフィール: フォロワー1人・フォロー中
        mockMvc.perform(get("/api/users/{username}", "takahashi")
                        .header("Authorization", "Bearer " + suzukiToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.followingCount").value(0))
                .andExpect(jsonPath("$.followerCount").value(1))
                .andExpect(jsonPath("$.followedByMe").value(true));

        // 高橋から見た鈴木のプロフィール: フォロー中1人・まだフォローしていない
        mockMvc.perform(get("/api/users/{username}", "suzuki")
                        .header("Authorization", "Bearer " + takahashiToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.followingCount").value(1))
                .andExpect(jsonPath("$.followerCount").value(0))
                .andExpect(jsonPath("$.followedByMe").value(false));
    }

    @Test
    void フォロー中タイムラインにフォロー外の投稿は混入せず自分の投稿は含まれる() throws Exception {
        String suzukiToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        String takahashiToken = signupAndGetAccessToken("takahashi@example.com", "高橋");
        String tanakaToken = signupAndGetAccessToken("tanaka@example.com", "田中");

        createPost(suzukiToken, "鈴木の投稿");
        createPost(takahashiToken, "高橋の投稿");
        createPost(tanakaToken, "田中の投稿");

        follow(suzukiToken, "takahashi");

        // 全体タイムラインは3件すべて
        mockMvc.perform(get("/api/posts")
                        .header("Authorization", "Bearer " + suzukiToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts", hasSize(3)));

        // フォロー中タイムラインは「高橋の投稿」＋「自分の投稿」の2件。田中の投稿は混入しない
        mockMvc.perform(get("/api/posts").param("timeline", "following")
                        .header("Authorization", "Bearer " + suzukiToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts", hasSize(2)))
                .andExpect(jsonPath("$.posts[*].content")
                        .value(org.hamcrest.Matchers.containsInAnyOrder("高橋の投稿", "鈴木の投稿")));
    }

    @Test
    void フォロー中タイムラインのページングが正しく動作する() throws Exception {
        String suzukiToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        String takahashiToken = signupAndGetAccessToken("takahashi@example.com", "高橋");
        follow(suzukiToken, "takahashi");

        createPost(takahashiToken, "高橋の投稿1");
        createPost(takahashiToken, "高橋の投稿2");

        mockMvc.perform(get("/api/posts").param("timeline", "following").param("page", "0").param("size", "1")
                        .header("Authorization", "Bearer " + suzukiToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts", hasSize(1)))
                .andExpect(jsonPath("$.hasNext").value(true));

        mockMvc.perform(get("/api/posts").param("timeline", "following").param("page", "1").param("size", "1")
                        .header("Authorization", "Bearer " + suzukiToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts", hasSize(1)))
                .andExpect(jsonPath("$.hasNext").value(false));
    }

    @Test
    void ユーザー削除でフォロー関係も連動削除される() throws Exception {
        String suzukiToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        signupAndGetAccessToken("takahashi@example.com", "高橋");
        follow(suzukiToken, "takahashi");

        jdbcTemplate.update("DELETE FROM users WHERE username = ?", "takahashi");

        Integer remaining = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM follows", Integer.class);
        Assertions.assertEquals(0, remaining);
    }
}
