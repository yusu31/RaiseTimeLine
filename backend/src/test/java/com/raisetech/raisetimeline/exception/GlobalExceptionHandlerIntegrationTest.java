package com.raisetech.raisetimeline.exception;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.raisetech.raisetimeline.mapper.UserMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
        String response = mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"handler@example.com","username":"handler","displayName":"ハンドラ","password":"password123"}
                                """))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("accessToken").asText();
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
}
