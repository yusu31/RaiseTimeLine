package com.raisetech.raisetimeline.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.GetUrlRequest;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.UUID;

/**
 * 画像を AWS S3 に保存する実装。{@code app.storage.type=s3} のときだけ登録される。
 *
 * <p>DBに保存するのはS3のキー（{@code UUID + 拡張子}）のみで、フルURLは持たない。
 * そのためバケット名やリージョンが変わってもDBの修正は不要。</p>
 */
@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "s3")
public class S3StorageService implements StorageService {

    private static final Logger log = LoggerFactory.getLogger(S3StorageService.class);

    private final S3Client s3Client;
    private final ImageValidator imageValidator;
    private final String bucket;

    public S3StorageService(S3Client s3Client,
                            ImageValidator imageValidator,
                            @Value("${app.storage.s3.bucket:}") String bucket) {
        if (bucket == null || bucket.isBlank()) {
            // 起動時に落とす。画像を投稿しようとした瞬間に初めて失敗する、という分かりにくい壊れ方を防ぐため
            throw new IllegalStateException(
                    "S3モードでは app.storage.s3.bucket（環境変数 APP_STORAGE_S3_BUCKET）の設定が必須です");
        }
        this.s3Client = s3Client;
        this.imageValidator = imageValidator;
        this.bucket = bucket;
    }

    @Override
    public String store(MultipartFile file) {
        imageValidator.validate(file);
        String key = UUID.randomUUID() + imageValidator.extensionOf(file);
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(file.getContentType())
                .build();
        try (InputStream in = file.getInputStream()) {
            s3Client.putObject(request, RequestBody.fromInputStream(in, file.getSize()));
        } catch (IOException e) {
            throw new UncheckedIOException("画像の保存に失敗しました", e);
        }
        return key;
    }

    /**
     * S3のキーを公開URLに変換する。
     *
     * <p>URLを自前で文字列連結せず SDK の {@code utilities()} に組み立てさせている。
     * リージョンごとのホスト名の違いや、キーのURLエンコードを取り違えないようにするため。</p>
     */
    @Override
    public String toPublicUrl(String storedPath) {
        return s3Client.utilities()
                .getUrl(GetUrlRequest.builder().bucket(bucket).key(storedPath).build())
                .toExternalForm();
    }

    /**
     * S3上のオブジェクトを削除する。
     *
     * <p>削除に失敗しても例外を投げない。投稿の削除そのものは完了しており、
     * ここで失敗を伝播させると「DBからは消えたのに画面上はエラー」という状態になるため。
     * 残ったオブジェクトはログを手掛かりに後から掃除する（{@link LocalStorageService} と同じ方針）。</p>
     */
    @Override
    public void delete(String storedPath) {
        try {
            s3Client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(storedPath).build());
        } catch (SdkException e) {
            log.warn("S3オブジェクトの削除に失敗しました: bucket={}, key={}", bucket, storedPath, e);
        }
    }
}
