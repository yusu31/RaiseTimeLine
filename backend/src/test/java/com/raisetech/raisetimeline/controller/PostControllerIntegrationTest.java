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

import static org.assertj.core.api.Assertions.assertThat;
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
        jdbcTemplate.execute("TRUNCATE TABLE posts, comments, likes, refresh_tokens, users RESTART IDENTITY CASCADE");
    }

    private String signupAndGetAccessToken(String email, String displayName) throws Exception {
        // username はメールアドレスの @ より前をそのまま使う（例: suzuki@example.com → suzuki）。
        // テストで使うメールはいずれも英数字4文字以上のため、SignupRequest のバリデーションを満たす。
        String username = email.substring(0, email.indexOf('@'));
        String response = mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","username":"%s","displayName":"%s","password":"password123"}
                                """.formatted(email, username, displayName)))
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
    void 新着投稿がないと新着件数は0が返る() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        String createResponse = mockMvc.perform(multipart("/api/posts")
                        .param("content", "最初の投稿")
                        .header("Authorization", "Bearer " + accessToken))
                .andReturn().getResponse().getContentAsString();
        long postId = objectMapper.readTree(createResponse).get("id").asLong();

        mockMvc.perform(get("/api/posts/new-count").param("afterId", String.valueOf(postId))
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(0));
    }

    @Test
    void afterIdより新しい投稿の件数だけ新着件数に反映される() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        String firstResponse = mockMvc.perform(multipart("/api/posts")
                        .param("content", "1件目")
                        .header("Authorization", "Bearer " + accessToken))
                .andReturn().getResponse().getContentAsString();
        long firstPostId = objectMapper.readTree(firstResponse).get("id").asLong();

        mockMvc.perform(multipart("/api/posts")
                .param("content", "2件目")
                .header("Authorization", "Bearer " + accessToken));
        mockMvc.perform(multipart("/api/posts")
                .param("content", "3件目")
                .header("Authorization", "Bearer " + accessToken));

        mockMvc.perform(get("/api/posts/new-count").param("afterId", String.valueOf(firstPostId))
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(2));
    }

    @Test
    void 新着投稿取得はafterIdより新しい投稿のみをid降順で返す() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        String firstResponse = mockMvc.perform(multipart("/api/posts")
                        .param("content", "1件目")
                        .header("Authorization", "Bearer " + accessToken))
                .andReturn().getResponse().getContentAsString();
        long firstPostId = objectMapper.readTree(firstResponse).get("id").asLong();

        mockMvc.perform(multipart("/api/posts")
                .param("content", "2件目")
                .header("Authorization", "Bearer " + accessToken));
        mockMvc.perform(multipart("/api/posts")
                .param("content", "3件目")
                .header("Authorization", "Bearer " + accessToken));

        mockMvc.perform(get("/api/posts/new").param("afterId", String.valueOf(firstPostId))
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(2))
                .andExpect(jsonPath("$.posts[0].content").value("3件目"))
                .andExpect(jsonPath("$.posts[1].content").value("2件目"))
                .andExpect(jsonPath("$.hasMore").value(false));
    }

    @Test
    void afterIdが最新idのとき新着投稿取得は空でhasMoreがfalse() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        String createResponse = mockMvc.perform(multipart("/api/posts")
                        .param("content", "最新の投稿")
                        .header("Authorization", "Bearer " + accessToken))
                .andReturn().getResponse().getContentAsString();
        long latestId = objectMapper.readTree(createResponse).get("id").asLong();

        mockMvc.perform(get("/api/posts/new").param("afterId", String.valueOf(latestId))
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(0))
                .andExpect(jsonPath("$.hasMore").value(false));
    }

    @Test
    void 新着投稿が上限を超えるとhasMoreがtrueになる() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        for (int i = 0; i < 51; i++) {
            mockMvc.perform(multipart("/api/posts")
                    .param("content", "投稿" + i)
                    .header("Authorization", "Bearer " + accessToken));
        }

        mockMvc.perform(get("/api/posts/new").param("afterId", "0")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(50))
                .andExpect(jsonPath("$.hasMore").value(true));
    }

    @Test
    void 新着チェック系エンドポイントは投稿詳細のパス変数解決と衝突しない() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        mockMvc.perform(get("/api/posts/new-count").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/posts/new").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk());
    }

    @Test
    void 認証なしで新着チェック系エンドポイントを呼ぶと401が返る() throws Exception {
        mockMvc.perform(get("/api/posts/new-count"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/posts/new"))
                .andExpect(status().isUnauthorized());
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

    @Test
    void 投稿検索はキーワードを含む投稿だけを新着順で返す() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        createPost(accessToken, "今日は良い天気です");
        createPost(accessToken, "無関係な投稿");
        createPost(accessToken, "天気が良いので散歩した");

        mockMvc.perform(get("/api/posts").param("q", "天気")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(2))
                // 新着順のため、後から投稿したものが先頭に来る
                .andExpect(jsonPath("$.posts[0].content").value("天気が良いので散歩した"))
                .andExpect(jsonPath("$.posts[1].content").value("今日は良い天気です"))
                .andExpect(jsonPath("$.hasNext").value(false));
    }

    @Test
    void 投稿検索は大文字小文字を区別しない() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        createPost(accessToken, "Spring Boot を勉強中");

        mockMvc.perform(get("/api/posts").param("q", "spring boot")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(1));
    }

    @Test
    void 投稿検索で該当がないときは空配列とhasNextfalseを返す() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        createPost(accessToken, "今日は良い天気です");

        mockMvc.perform(get("/api/posts").param("q", "存在しないキーワード")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(0))
                .andExpect(jsonPath("$.hasNext").value(false));
    }

    @Test
    void 投稿検索でパーセント1文字を渡しても全件は返らない() throws Exception {
        // % は LIKE のワイルドカード。エスケープしないと LIKE '%%%' となり全投稿に一致してしまう。
        // この挙動を壊さないための回帰テスト
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        createPost(accessToken, "今日は良い天気です");
        createPost(accessToken, "無関係な投稿");

        mockMvc.perform(get("/api/posts").param("q", "%")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(0));
    }

    @Test
    void 投稿検索で空文字や空白のみのときは全件ではなく空を返す() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");
        createPost(accessToken, "今日は良い天気です");

        mockMvc.perform(get("/api/posts").param("q", "")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(0));

        mockMvc.perform(get("/api/posts").param("q", "   ")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(0));
    }

    @Test
    void 認証なしで投稿検索をすると401が返る() throws Exception {
        mockMvc.perform(get("/api/posts").param("q", "天気"))
                .andExpect(status().isUnauthorized());
    }

    // ------------------------------------------------------------------
    // 想定外の入力（Issue #79 で発見）
    //
    // ブラウザの通常操作では起こらないが、URLを手で書き換えれば誰でも送れる入力を確かめる。
    //
    // 型変換の失敗は Issue #81 で 400 に直した。
    // 500 は「サーバー側が壊れた」という意味であり、送られてきた値の形式が不正なだけの場合は
    // 400 が正しい。取り違えると、本当にサーバーが壊れたときにログの中で埋もれて気づけなくなる。
    //
    // けた溢れ（下記）はまだ 500 のまま。Issue #82 で直す。
    // ------------------------------------------------------------------

    @Test
    void ページ番号が数値でないと400が返る() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        mockMvc.perform(get("/api/posts").param("page", "abc")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void ページサイズが数値でないと400が返る() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        mockMvc.perform(get("/api/posts").param("size", "abc")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 投稿IDが数値でないと400が返る() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        mockMvc.perform(get("/api/posts/abc")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 新着件数のafterIdが数値でないと400が返る() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        mockMvc.perform(get("/api/posts/new-count").param("afterId", "abc")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void ページ番号がintの範囲を超えると400が返る() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        // 数字ではあるが int に収まらない。これも型変換の失敗として扱われる
        mockMvc.perform(get("/api/posts").param("page", "99999999999")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 投稿IDが数値でないときエラー本文に送信された値をそのまま含めない() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        // 受け取った値をそのまま返すと、リクエストに仕込まれた文字列を画面へ持ち帰ることになる。
        // どの項目が不正かは伝えるが、送られてきた中身は返さない
        String body = mockMvc.perform(get("/api/posts/should-not-be-echoed")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain("should-not-be-echoed");
    }

    @Test
    void 掛け算がintに収まる範囲のページ番号では空ページを正常に返す() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        // 107374182 × 20 = 2147483640 で int にぎりぎり収まる。
        // 該当する投稿は無いので空配列が返るのが正しい
        mockMvc.perform(get("/api/posts").param("page", "107374182").param("size", "20")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(0))
                .andExpect(jsonPath("$.hasNext").value(false));
    }

    @Test
    void ページ番号が1つ大きく掛け算がintの範囲を超えても空ページを正常に返す() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        // 107374183 × 20 = 2147483660。int で計算していたら一周して負になり、
        // 負の OFFSET を PostgreSQL が拒否して 500 になっていた（Issue #82）
        mockMvc.perform(get("/api/posts").param("page", "107374183").param("size", "20")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(0))
                .andExpect(jsonPath("$.hasNext").value(false));
    }

    @Test
    void ページ番号がintの最大値でも空ページを正常に返す() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        // 最初に症状として報告された値。ページサイズの上限100と組み合わせても壊れない
        mockMvc.perform(get("/api/posts").param("page", "2147483647").param("size", "100")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(0));
    }

    @Test
    void フォロー中タイムラインでもintの範囲を超える位置で空ページを正常に返す() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        mockMvc.perform(get("/api/posts")
                        .param("timeline", "following").param("page", "107374183").param("size", "20")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(0));
    }

    @Test
    void 投稿検索でもintの範囲を超える位置で空ページを正常に返す() throws Exception {
        String accessToken = signupAndGetAccessToken("suzuki@example.com", "鈴木");

        mockMvc.perform(get("/api/posts")
                        .param("q", "天気").param("page", "107374183").param("size", "20")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts.length()").value(0));
    }

    /** 投稿を1件作成する。検索テストのように本文だけを用意したい場面で使う */
    private void createPost(String accessToken, String content) throws Exception {
        mockMvc.perform(multipart("/api/posts")
                .param("content", content)
                .header("Authorization", "Bearer " + accessToken));
    }
}
