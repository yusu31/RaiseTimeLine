package com.raisetech.raisetimeline.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class UserControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Value("${app.upload-dir}")
    private String uploadDir;

    @BeforeEach
    void cleanDatabase() {
        jdbcTemplate.execute("TRUNCATE TABLE posts, comments, likes, refresh_tokens, users RESTART IDENTITY CASCADE");
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
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isCreated());
    }

    private MockMultipartFile pngFile() {
        return new MockMultipartFile("image", "icon.png", "image/png", "dummy-png-content".getBytes());
    }

    @Test
    void 認証なしではプロフィール取得も更新も401が返る() throws Exception {
        mockMvc.perform(get("/api/users/suzuki"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(put("/api/users/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"displayName":"鈴木","username":"suzuki","bio":""}
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 存在しないユーザー名のプロフィール取得は404が返る() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        mockMvc.perform(get("/api/users/notfound")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void プロフィールを取得すると表示名とユーザー名が返る() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        mockMvc.perform(get("/api/users/suzuki")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("suzuki"))
                .andExpect(jsonPath("$.displayName").value("鈴木"))
                .andExpect(jsonPath("$.bio").doesNotExist())
                .andExpect(jsonPath("$.iconImageUrl").doesNotExist());
    }

    @Test
    void 表示名と自己紹介を更新できる() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        mockMvc.perform(put("/api/users/me")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"displayName":"鈴木一郎","username":"suzuki","bio":"はじめまして"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("鈴木一郎"));

        mockMvc.perform(get("/api/users/suzuki")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(jsonPath("$.displayName").value("鈴木一郎"))
                .andExpect(jsonPath("$.bio").value("はじめまして"));
    }

    @Test
    void 自己紹介が161文字だと400が返る() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        String tooLongBio = "あ".repeat(161);

        mockMvc.perform(put("/api/users/me")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"displayName":"鈴木","username":"suzuki","bio":"%s"}
                                """.formatted(tooLongBio)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 他人が使っているユーザー名に変更すると409が返る() throws Exception {
        signupAndGetAccessToken("tanaka@example.com", "田中");
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        mockMvc.perform(put("/api/users/me")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"displayName":"鈴木","username":"tanaka","bio":""}
                                """))
                .andExpect(status().isConflict());
    }

    @Test
    void ユーザー名を変えずに保存しても409にならない() throws Exception {
        // 自分自身を重複判定から除外できているかの確認。
        // 除外し忘れると「表示名だけ直して保存」が常に409になる
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        mockMvc.perform(put("/api/users/me")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"displayName":"鈴木二郎","username":"suzuki","bio":""}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("suzuki"));
    }

    @Test
    void ユーザー名を変更すると新しい名前でプロフィールを取得できる() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        mockMvc.perform(put("/api/users/me")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"displayName":"鈴木","username":"suzuki_new","bio":""}
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/users/suzuki_new")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk());
        // 旧ユーザー名では到達できなくなる（X と同じ挙動）
        mockMvc.perform(get("/api/users/suzuki")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void アイコン画像をアップロードすると差し替え時に旧ファイルが削除される() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        String first = mockMvc.perform(multipart("/api/users/me/icon")
                        .file(pngFile())
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.iconImageUrl").exists())
                .andReturn().getResponse().getContentAsString();
        String firstUrl = objectMapper.readTree(first).get("iconImageUrl").asText();
        String firstFilename = firstUrl.substring(firstUrl.lastIndexOf('/') + 1);
        assertThat(Files.exists(Path.of(uploadDir).resolve(firstFilename))).isTrue();

        String second = mockMvc.perform(multipart("/api/users/me/icon")
                        .file(pngFile())
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String secondUrl = objectMapper.readTree(second).get("iconImageUrl").asText();
        assertThat(secondUrl).isNotEqualTo(firstUrl);

        // 差し替え後、古いファイルは物理的に消えている
        assertThat(Files.exists(Path.of(uploadDir).resolve(firstFilename))).isFalse();
    }

    @Test
    void 対応していない形式のアイコン画像は400が返る() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        MockMultipartFile gif = new MockMultipartFile("image", "icon.gif", "image/gif", "dummy".getBytes());

        mockMvc.perform(multipart("/api/users/me/icon")
                        .file(gif)
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void ユーザーの投稿一覧には本人の投稿だけが返る() throws Exception {
        String suzuki = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        String tanaka = signupAndGetAccessToken("tanaka@example.com", "田中");
        createPost(suzuki, "鈴木の投稿1");
        createPost(suzuki, "鈴木の投稿2");
        createPost(tanaka, "田中の投稿");

        mockMvc.perform(get("/api/users/suzuki/posts")
                        .header("Authorization", "Bearer " + suzuki))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(2))
                .andExpect(jsonPath("$.posts[0].author.username").value("suzuki"))
                .andExpect(jsonPath("$.posts[1].author.username").value("suzuki"))
                .andExpect(jsonPath("$.hasNext").value(false));
    }

    @Test
    void 投稿一覧の著者情報にアイコン画像のURLが含まれる() throws Exception {
        // アイコンをヘッダーだけでなく投稿カードにも表示するため、
        // PostDetail 経由で著者のアイコンが流れてくることを確認する
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        mockMvc.perform(multipart("/api/users/me/icon")
                        .file(pngFile())
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk());
        createPost(accessToken, "アイコン付きの投稿");

        mockMvc.perform(get("/api/posts")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts[0].author.iconImageUrl").exists());
    }

    @Test
    void 認証なしのユーザー検索は401が返る() throws Exception {
        mockMvc.perform(get("/api/users").param("q", "suzuki"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void ユーザー名でも表示名でも部分一致で検索できる() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木太郎");
        signupAndGetAccessToken("takahashi@example.com", "高橋花子");

        // @ユーザー名の一部（前方でも後方でもない位置）で一致する。検索者自身も結果に含める
        mockMvc.perform(get("/api/users").param("q", "zuk")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].username").value("suzuki"))
                .andExpect(jsonPath("$[0].displayName").value("鈴木太郎"));

        // 表示名の一部でも一致する
        mockMvc.perform(get("/api/users").param("q", "花子")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].username").value("takahashi"));
    }

    @Test
    void ユーザー検索は大文字小文字を区別しない() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        mockMvc.perform(get("/api/users").param("q", "SUZUKI")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].username").value("suzuki"));
    }

    @Test
    void 該当者がいないときは空配列が返る() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        mockMvc.perform(get("/api/users").param("q", "zzz")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    /**
     * 空文字とワイルドカードのどちらでも全件が返らないことを確認する。
     * エスケープしないと「%」の1文字検索がLIKE '%%%'となり、全ユーザーが一致してしまう。
     */
    @Test
    void 空文字やワイルドカードだけの検索で全件は返らない() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        signupAndGetAccessToken("takahashi@example.com", "高橋");

        mockMvc.perform(get("/api/users").param("q", "")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));

        mockMvc.perform(get("/api/users").param("q", "%")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));

        mockMvc.perform(get("/api/users").param("q", "_")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }
}
