package com.raisetech.raisetimeline.service;

import com.raisetech.raisetimeline.exception.InvalidImageException;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.util.Locale;
import java.util.Set;

/**
 * アップロードされた画像の検証と拡張子取得を担当する。
 * {@link LocalStorageService} と S3実装が共有する唯一のルールとして切り出している。
 * （各実装にコピーすると、片方だけ修正して挙動がずれる事故が起きるため）
 */
@Component
public class ImageValidator {

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of("image/jpeg", "image/png");
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(".jpg", ".jpeg", ".png");
    private static final long MAX_FILE_SIZE = 5L * 1024 * 1024;

    /**
     * 画像として受け入れてよいファイルかを検証する。
     *
     * @throws InvalidImageException 形式・拡張子・サイズのいずれかが条件を満たさない場合
     */
    public void validate(MultipartFile file) {
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

    /**
     * 元のファイル名から拡張子（先頭のドットを含む）を取り出す。拡張子が無い場合は空文字を返す。
     */
    public String extensionOf(MultipartFile file) {
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null) {
            return "";
        }
        int dotIndex = originalFilename.lastIndexOf('.');
        return dotIndex >= 0 ? originalFilename.substring(dotIndex) : "";
    }
}
