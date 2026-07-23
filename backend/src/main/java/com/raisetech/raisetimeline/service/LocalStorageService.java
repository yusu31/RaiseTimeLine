package com.raisetech.raisetimeline.service;

import com.raisetech.raisetimeline.exception.InvalidImageException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * 画像をローカルファイルシステムに保存する実装。
 * ローカル開発専用。本番環境ではAWS S3実装（{@link StorageService}の別実装）に差し替える想定。
 */
@Service
public class LocalStorageService implements StorageService {

    private static final Logger log = LoggerFactory.getLogger(LocalStorageService.class);

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of("image/jpeg", "image/png");
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(".jpg", ".jpeg", ".png");
    private static final long MAX_FILE_SIZE = 5L * 1024 * 1024;

    private final Path uploadDir;

    public LocalStorageService(@Value("${app.upload-dir:uploads}") String uploadDir) {
        this.uploadDir = Path.of(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.uploadDir);
        } catch (IOException e) {
            throw new UncheckedIOException("アップロード先ディレクトリの作成に失敗しました: " + this.uploadDir, e);
        }
    }

    @Override
    public String store(MultipartFile file) {
        validate(file);
        String filename = UUID.randomUUID() + extensionOf(file);
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

    private void validate(MultipartFile file) {
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new InvalidImageException("画像はJPEGまたはPNG形式のみアップロードできます");
        }
        String extension = extensionOf(file);
        if (!ALLOWED_EXTENSIONS.contains(extension.toLowerCase(Locale.ROOT))) {
            throw new InvalidImageException("画像はJPEGまたはPNG形式のみアップロードできます");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new InvalidImageException("画像は5MB以内のファイルをアップロードしてください");
        }
    }

    private String extensionOf(MultipartFile file) {
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null) {
            return "";
        }
        int dotIndex = originalFilename.lastIndexOf('.');
        return dotIndex >= 0 ? originalFilename.substring(dotIndex) : "";
    }
}
