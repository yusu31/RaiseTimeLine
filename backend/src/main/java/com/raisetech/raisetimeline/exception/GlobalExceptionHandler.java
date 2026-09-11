package com.raisetech.raisetimeline.exception;

import com.raisetech.raisetimeline.response.ErrorResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(error -> error.getDefaultMessage())
                .orElse("入力内容に誤りがあります");
        return build(HttpStatus.BAD_REQUEST, message);
    }

    /**
     * クエリパラメータやパス変数を引数の型へ変換できないときに 400 を返す。
     *
     * <p>{@code ?page=abc} や {@code /api/posts/abc} のように、数値のはずの場所に
     * 数値でない値が来ると Spring MVC は {@link MethodArgumentTypeMismatchException} を投げる。
     * 専用のハンドラが無いと下の catch-all に落ち、<strong>500</strong>（サーバー側が壊れた）を
     * 返してしまう。実際は送られてきた値の形式が不正なだけなので 400 が正しい。
     *
     * <p>取り違えると、監視が見る 5xx が日常的に鳴り、本当にサーバーが壊れたときに埋もれる。
     *
     * <p><strong>受け取った値そのものは本文に含めない。</strong>リクエストに仕込まれた文字列を
     * そのまま返すことになるため。どの項目が不正かだけを伝える。
     * ログも WARN 1行にとどめる（外部からのスキャンで日常的に発生し、スタックトレースは過剰）。
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        log.warn("パラメータの型変換に失敗しました: name={}", ex.getName());
        return build(HttpStatus.BAD_REQUEST, "パラメータ " + ex.getName() + " の形式が正しくありません");
    }

    @ExceptionHandler(EmailAlreadyExistsException.class)
    public ResponseEntity<ErrorResponse> handleEmailAlreadyExists(EmailAlreadyExistsException ex) {
        return build(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(UsernameAlreadyExistsException.class)
    public ResponseEntity<ErrorResponse> handleUsernameAlreadyExists(UsernameAlreadyExistsException ex) {
        return build(HttpStatus.CONFLICT, ex.getMessage());
    }

    /**
     * DBのユニーク制約に違反したときに 409 を返す。
     *
     * <p>Service は書き込む前に「重複していないか」を調べているが、
     * <strong>調べてから書き込むまでのあいだ</strong>に別のリクエストが同じ値を取ると、
     * 書き込みの時点で制約違反になる（{@code uk_users_email} / {@code uk_users_username}）。
     * 専用のハンドラが無いと catch-all に落ち、500 を返してしまう。
     *
     * <p><strong>ここは事前チェックの代わりではなく、その隙間の受け皿。</strong>
     * ふだんの重複は Service が {@link UsernameAlreadyExistsException} などで弾いており、
     * そちらは「@ユーザー名」「メールアドレス」と項目名の入った文言を返す。
     * このハンドラに到達するのは競合したときだけなので、
     * <strong>どの制約に違反したかは推測せず</strong>、一般的な文言にとどめる。
     *
     * <p>制約名（{@code uk_users_username}）はDBの内部構造なので本文に含めない。
     * ログには残す（どの制約で競合したかは運用側では知りたいため）。
     */
    @ExceptionHandler(DuplicateKeyException.class)
    public ResponseEntity<ErrorResponse> handleDuplicateKey(DuplicateKeyException ex) {
        log.warn("ユニーク制約違反が発生しました（重複チェックとの競合の可能性）", ex);
        return build(HttpStatus.CONFLICT, "入力された値は既に使われています。入力内容を確認してください");
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleInvalidCredentials(InvalidCredentialsException ex) {
        return build(HttpStatus.UNAUTHORIZED, ex.getMessage());
    }

    @ExceptionHandler(InvalidRefreshTokenException.class)
    public ResponseEntity<ErrorResponse> handleInvalidRefreshToken(InvalidRefreshTokenException ex) {
        return build(HttpStatus.UNAUTHORIZED, ex.getMessage());
    }

    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleUserNotFound(UserNotFoundException ex) {
        return build(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(PostNotFoundException.class)
    public ResponseEntity<ErrorResponse> handlePostNotFound(PostNotFoundException ex) {
        return build(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(PostAccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handlePostAccessDenied(PostAccessDeniedException ex) {
        return build(HttpStatus.FORBIDDEN, ex.getMessage());
    }

    @ExceptionHandler(InvalidPostContentException.class)
    public ResponseEntity<ErrorResponse> handleInvalidPostContent(InvalidPostContentException ex) {
        return build(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    @ExceptionHandler(InvalidImageException.class)
    public ResponseEntity<ErrorResponse> handleInvalidImage(InvalidImageException ex) {
        return build(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    @ExceptionHandler(CommentNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleCommentNotFound(CommentNotFoundException ex) {
        return build(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(CommentAccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleCommentAccessDenied(CommentAccessDeniedException ex) {
        return build(HttpStatus.FORBIDDEN, ex.getMessage());
    }

    @ExceptionHandler(InvalidCommentContentException.class)
    public ResponseEntity<ErrorResponse> handleInvalidCommentContent(InvalidCommentContentException ex) {
        return build(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    @ExceptionHandler(SelfFollowException.class)
    public ResponseEntity<ErrorResponse> handleSelfFollow(SelfFollowException ex) {
        return build(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleMaxUploadSizeExceeded(MaxUploadSizeExceededException ex) {
        return build(HttpStatus.BAD_REQUEST, "アップロードできるファイルサイズを超えています");
    }

    /**
     * 存在しないURLへのアクセスを 404 で返す。
     *
     * <p>担当のコントローラも静的リソースも見つからないとき、Spring MVC は
     * {@link NoResourceFoundException} を投げる。専用のハンドラが無いと下の catch-all に落ち、
     * 「予期しないエラー」として 500 とスタックトレースを出力してしまうため、ここで拾う。
     *
     * <p>ログは WARN でパスのみ1行にとどめる。存在しないファイルへのアクセスは
     * ブラウザのキャッシュや外部からのスキャンで日常的に発生し、ERROR とスタックトレースは過剰なため。
     * レスポンス本文にはパスを含めない（サーバー内部の情報をクライアントに返さない）。
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResourceFound(NoResourceFoundException ex) {
        log.warn("存在しないリソースへのアクセス: {} {}", ex.getHttpMethod(), ex.getResourcePath());
        return build(HttpStatus.NOT_FOUND, "リソースが見つかりません");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex) {
        log.error("予期しないエラーが発生しました", ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "サーバー内部でエラーが発生しました");
    }

    private ResponseEntity<ErrorResponse> build(HttpStatus status, String message) {
        ErrorResponse body = new ErrorResponse(status.value(), status.getReasonPhrase(), message);
        return ResponseEntity.status(status).body(body);
    }
}
