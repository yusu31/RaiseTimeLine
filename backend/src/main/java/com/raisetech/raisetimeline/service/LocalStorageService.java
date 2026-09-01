package com.raisetech.raisetimeline.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

/**
 * 画像をローカルファイルシステムに保存する実装。
 * ローカル開発用で、S3モード（{@code app.storage.type=s3}）では登録されない。
 *
 * <p>{@code matchIfMissing = true} により、設定を書き忘れた環境では必ずこの実装が選ばれる。
 * 意図せずS3が有効化されて課金が発生する事故を、構造として防ぐための安全装置。</p>
 */
@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalStorageService implements StorageService {

    private static final Logger log = LoggerFactory.getLogger(LocalStorageService.class);

    private final Path uploadDir;
    private final ImageValidator imageValidator;

    public LocalStorageService(@Value("${app.upload-dir:uploads}") String uploadDir, ImageValidator imageValidator) {
        this.uploadDir = Path.of(uploadDir).toAbsolutePath().normalize();
        this.imageValidator = imageValidator;
        try {
            Files.createDirectories(this.uploadDir);
        } catch (IOException e) {
            throw new UncheckedIOException("アップロード先ディレクトリの作成に失敗しました: " + this.uploadDir, e);
        }
    }

    @Override
    public String store(MultipartFile file) {
        imageValidator.validate(file);
        String filename = UUID.randomUUID() + imageValidator.extensionOf(file);
        Path destination = uploadDir.resolve(filename);
        try {
            file.transferTo(destination);
        } catch (IOException e) {
            throw new UncheckedIOException("画像の保存に失敗しました", e);
        }
        return filename;
    }

    @Override
    public String toPublicUrl(String storedPath) {
        return "/uploads/" + storedPath;
    }

    @Override
    public void delete(String storedPath) {
        try {
            Files.deleteIfExists(uploadDir.resolve(storedPath));
        } catch (IOException e) {
            log.warn("画像ファイルの削除に失敗しました: {}", storedPath, e);
        }
    }
}
