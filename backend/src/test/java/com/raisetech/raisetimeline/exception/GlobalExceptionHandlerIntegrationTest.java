package com.raisetech.raisetimeline.exception;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.raisetech.raisetimeline.mapper.UserMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(OutputCaptureExtension.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GlobalExceptionHandlerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * 事前チェックの結果だけを差し替えるため、モックではなく <strong>spy</strong>（本物を包む見張り）を使う。
     * 差し替えていないメソッドは本物のまま動くので、DBのユニーク制約に実際に当たる。
     */
    @MockitoSpyBean
    private UserMapper userMapper;

    @BeforeEach
    void cleanDatabase() {
        jdbcTemplate.execute("TRUNCATE TABLE posts, comments, likes, refresh_tokens, users RESTART IDENTITY CASCADE");
    }

    private String signupAndGetAccessToken() throws Exception {
        return signupAndGetAccessToken("handler@example.com", "handler", "ハンドラ");
    }

    private String signupAndGetAccessToken(String email, String username, String displayName) throws Exception {
        String response = mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","username":"%s","displayName":"%s","password":"password123"}
                                """.formatted(email, username, displayName)))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("accessToken").asText();
    }

    private long createPost(String accessToken) throws Exception {
        String response = mockMvc.perform(multipart("/api/posts")
                        .param("content", "投稿本文")
                        .header("Authorization", "Bearer " + accessToken))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    private long createComment(String accessToken, long postId) throws Exception {
        String response = mockMvc.perform(post("/api/posts/" + postId + "/comments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"コメント本文"}
                                """)
                        .header("Authorization", "Bearer " + accessToken))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    @Test
    void 存在しない静的リソースへのアクセスは404を返す() throws Exception {
        mockMvc.perform(get("/uploads/no-such-image.jpg"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"))
                .andExpect(jsonPath("$.message").value("リソースが見つかりません"));
    }

    @Test
    void 存在しないAPIパスへのアクセスは認証済みでも404を返す() throws Exception {
        String accessToken = signupAndGetAccessToken();

        mockMvc.perform(get("/api/no-such-endpoint")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("リソースが見つかりません"));
    }

    @Test
    void 存在しないAPIパスへの未認証アクセスは401を返す() throws Exception {
        mockMvc.perform(get("/api/no-such-endpoint"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void エラーレスポンスにリクエストされたパスを含めない() throws Exception {
        String body = mockMvc.perform(get("/uploads/secret-path-should-not-leak.jpg"))
                .andExpect(status().isNotFound())
                .andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain("secret-path-should-not-leak");
    }

    /**
     * 「重複していないか調べる」→「書き込む」の2手のあいだに、別のリクエストが
     * 同じ@ユーザー名を取ってしまった状況（TOCTOU）を再現する。
     *
     * <p><strong>本物の並行実行は使わない。</strong>タイミング次第で競合したりしなかったりして、
     * 実行するたび結果が変わるテスト（フレーキーテスト）になるため。
     * 確かめたいのは「競合が起きること」ではなく<strong>「競合が起きたとき何が返るか」</strong>なので、
     * 事前チェックの結果だけを差し替え、<strong>DBのユニーク制約は本物のまま</strong>にする。</p>
     */
    @Test
    void 重複チェックをすり抜けた制約違反は409を返す() throws Exception {
        String accessToken = signupAndGetAccessToken();
        // 別のユーザーが先に takenname を取得している
        jdbcTemplate.update(
                "INSERT INTO users (email, username, display_name, password_hash) VALUES (?, ?, ?, ?)",
                "other@example.com", "takenname", "他人", "dummy-hash");
        // 「調べた時点では空いている」状態だけを作る（書き込みは本物のDBに当たる）
        doReturn(false).when(userMapper).existsByUsernameExcludingSelf(eq("takenname"), anyLong());

        mockMvc.perform(put("/api/users/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"displayName":"ハンドラ","username":"takenname","bio":""}
                                """)
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.error").value("Conflict"));
    }

    @Test
    void 制約違反のエラーレスポンスにDBの制約名を含めない() throws Exception {
        String accessToken = signupAndGetAccessToken();
        jdbcTemplate.update(
                "INSERT INTO users (email, username, display_name, password_hash) VALUES (?, ?, ?, ?)",
                "other@example.com", "takenname", "他人", "dummy-hash");
        doReturn(false).when(userMapper).existsByUsernameExcludingSelf(eq("takenname"), anyLong());

        // 制約名（uk_users_username）はDBの内部構造。クライアントに返さない
        String body = mockMvc.perform(put("/api/users/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"displayName":"ハンドラ","username":"takenname","bio":""}
                                """)
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isConflict())
                .andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain("uk_users");
        assertThat(body).doesNotContain("constraint");
    }

    // --- ここから: 想定内の業務ルール違反（4xx）にWARNログが出ることの確認。 ---
    // 起きても正常だが、頻発したら運用側が気付けるようにする。想定内の失敗なのでスタックトレースは付けない

    @Test
    void メールアドレス重複はWARNログを出し409を返す(CapturedOutput output) throws Exception {
        signupAndGetAccessToken("dup@example.com", "userone", "ユーザー1");

        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"dup@example.com","username":"usertwo","displayName":"ユーザー2","password":"password123"}
                                """))
                .andExpect(status().isConflict());

        assertThat(output).contains("このメールアドレスは既に登録されています");
    }

    @Test
    void ユーザー名重複はWARNログを出し409を返す(CapturedOutput output) throws Exception {
        signupAndGetAccessToken("userone@example.com", "dupname", "ユーザー1");

        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"usertwo@example.com","username":"dupname","displayName":"ユーザー2","password":"password123"}
                                """))
                .andExpect(status().isConflict());

        assertThat(output).contains("このユーザー名は既に使われています");
    }

    @Test
    void ログイン失敗はWARNログを出し401を返す(CapturedOutput output) throws Exception {
        signupAndGetAccessToken("login@example.com", "loginuser", "ログインユーザー");

        String body = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"login@example.com","password":"wrong-password"}
                                """))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

        String message = objectMapper.readTree(body).get("message").asText();
        assertThat(output).contains(message);
    }

    @Test
    void 不正なリフレッシュトークンはWARNログを出し401を返す(CapturedOutput output) throws Exception {
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"refreshToken":"no-such-refresh-token"}
                                """))
                .andExpect(status().isUnauthorized());

        // 存在しないトークンは「無効です」。「期限切れ」は別のメッセージ（存在はするが期限が過ぎた場合）
        assertThat(output).contains("リフレッシュトークンが無効です");
    }

    @Test
    void 存在しないユーザーのプロフィール取得はWARNログを出し404を返す(CapturedOutput output) throws Exception {
        String accessToken = signupAndGetAccessToken();

        mockMvc.perform(get("/api/users/no-such-user")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isNotFound());

        assertThat(output).contains("ユーザーが見つかりません");
    }

    @Test
    void 存在しない投稿の取得はWARNログを出し404を返す(CapturedOutput output) throws Exception {
        String accessToken = signupAndGetAccessToken();

        mockMvc.perform(get("/api/posts/999999")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isNotFound());

        assertThat(output).contains("投稿が見つかりません");
    }

    /**
     * JwtAuthenticationFilter が MDC に積んだ userId が、ハンドラの WARN 行にも自動で載ることを確認する。
     * ハンドラ自身は userId を書いていない。「誰の操作で起きた警告か」を後から追えるのは MDC のおかげ。
     * MDC 由来の項目は Filter → Handler が実際に連なって動く統合テストでしか検証できない。
     */
    @Test
    void 認証済みリクエストのWARNログにrequestIdとuserIdの両方が載る(CapturedOutput output) throws Exception {
        String accessToken = signupAndGetAccessToken();

        mockMvc.perform(get("/api/posts/999999")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isNotFound());

        String line = output.getOut().lines()
                .filter(l -> l.contains("投稿が見つかりません"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("WARNログが出力されていない"));
        assertThat(line).matches(".*\\[reqId:[0-9a-f-]{36}\\].*");
        // TRUNCATE ... RESTART IDENTITY で毎回IDが1から振り直されるため、最初に登録したユーザーは必ず1
        assertThat(line).contains("[userId:1]");
    }

    @Test
    void 他人の投稿の削除はWARNログを出し403を返す(CapturedOutput output) throws Exception {
        String ownerToken = signupAndGetAccessToken("owner@example.com", "postowner", "投稿主");
        String otherToken = signupAndGetAccessToken("other@example.com", "otheruser", "別のユーザー");
        long postId = createPost(ownerToken);

        mockMvc.perform(delete("/api/posts/" + postId)
                        .header("Authorization", "Bearer " + otherToken))
                .andExpect(status().isForbidden());

        assertThat(output).contains("この投稿を操作する権限がありません");
    }

    @Test
    void 存在しないコメントの削除はWARNログを出し404を返す(CapturedOutput output) throws Exception {
        String accessToken = signupAndGetAccessToken();

        mockMvc.perform(delete("/api/comments/999999")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isNotFound());

        assertThat(output).contains("コメントが見つかりません");
    }

    @Test
    void 構文が壊れたJSONを送ると500ではなく400を返す() throws Exception {
        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ この文字列はJSONとして壊れている"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"));
    }

    @Test
    void 壊れたJSONのWARNログにリクエストボディの内容を含めない(CapturedOutput output) throws Exception {
        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ この文字列はJSONとして壊れている"))
                .andExpect(status().isBadRequest());

        assertThat(output).doesNotContain("この文字列はJSONとして壊れている");
    }

    @Test
    void 他人のコメントの削除はWARNログを出し403を返す(CapturedOutput output) throws Exception {
        String postOwnerToken = signupAndGetAccessToken("postowner@example.com", "postowner2", "投稿主");
        String commentOwnerToken = signupAndGetAccessToken("commentowner@example.com", "commentowner", "コメント主");
        long postId = createPost(postOwnerToken);
        long commentId = createComment(commentOwnerToken, postId);

        mockMvc.perform(delete("/api/comments/" + commentId)
                        .header("Authorization", "Bearer " + postOwnerToken))
                .andExpect(status().isForbidden());

        assertThat(output).contains("このコメントを操作する権限がありません");
    }
}
