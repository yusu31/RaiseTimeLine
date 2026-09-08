package com.raisetech.raisetimeline.service;

import com.raisetech.raisetimeline.exception.InvalidImageException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * {@link ImageValidator} のテスト。DBもSpringも使わない。
 *
 * <p>サイズの上限は 5MB。<strong>「ちょうど5MB」と「5MB+1バイト」の両方</strong>を確認する。
 * この種の不具合は、条件を {@code >} と {@code >=} のどちらで書くかの取り違えで起き、
 * 中間の値（3MBなど）をいくら試しても見つからないため。</p>
 */
class ImageValidatorTest {

    private static final long MAX_FILE_SIZE = 5L * 1024 * 1024;

    private final ImageValidator imageValidator = new ImageValidator();

    private MultipartFile file(String filename, String contentType, int sizeInBytes) {
        return new MockMultipartFile("image", filename, contentType, new byte[sizeInBytes]);
    }

    @Nested
    @DisplayName("受け入れる画像")
    class Accepted {

        @Test
        @DisplayName("JPEG（.jpg）は受け入れる")
        void acceptsJpeg() {
            assertThatCode(() -> imageValidator.validate(file("photo.jpg", "image/jpeg", 100)))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("JPEG（.jpeg）も受け入れる")
        void acceptsJpegWithLongExtension() {
            assertThatCode(() -> imageValidator.validate(file("photo.jpeg", "image/jpeg", 100)))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("PNG は受け入れる")
        void acceptsPng() {
            assertThatCode(() -> imageValidator.validate(file("photo.png", "image/png", 100)))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("形式・拡張子の大文字小文字は区別しない（.JPG や IMAGE/JPEG も通す）")
        void isCaseInsensitive() {
            assertThatCode(() -> imageValidator.validate(file("PHOTO.JPG", "IMAGE/JPEG", 100)))
                    .doesNotThrowAnyException();
        }
    }

    @Nested
    @DisplayName("拒否する画像")
    class Rejected {

        @Test
        @DisplayName("形式が未指定（null）なら拒否する")
        void rejectsNullContentType() {
            assertThatThrownBy(() -> imageValidator.validate(file("photo.jpg", null, 100)))
                    .isInstanceOf(InvalidImageException.class)
                    .hasMessageContaining("JPEGまたはPNG");
        }

        @Test
        @DisplayName("画像でない形式（text/plain）は拒否する")
        void rejectsNonImageContentType() {
            assertThatThrownBy(() -> imageValidator.validate(file("note.txt", "text/plain", 100)))
                    .isInstanceOf(InvalidImageException.class);
        }

        @Test
        @DisplayName("画像でも許可していない形式（GIF）は拒否する")
        void rejectsUnsupportedImageFormat() {
            assertThatThrownBy(() -> imageValidator.validate(file("photo.gif", "image/gif", 100)))
                    .isInstanceOf(InvalidImageException.class);
        }

        @Test
        @DisplayName("形式は正しくても拡張子が違えば拒否する（形式と拡張子の両方を見ている）")
        void rejectsMismatchedExtension() {
            // Content-Type は送信側が自由に名乗れるため、拡張子も併せて確認している
            assertThatThrownBy(() -> imageValidator.validate(file("photo.txt", "image/jpeg", 100)))
                    .isInstanceOf(InvalidImageException.class);
        }

        @Test
        @DisplayName("拡張子が無ければ拒否する")
        void rejectsFileWithoutExtension() {
            assertThatThrownBy(() -> imageValidator.validate(file("photo", "image/jpeg", 100)))
                    .isInstanceOf(InvalidImageException.class);
        }
    }

    @Nested
    @DisplayName("サイズの上限（5MB）")
    class FileSize {

        @Test
        @DisplayName("ちょうど5MBは受け入れる（上限ちょうど）")
        void acceptsExactlyMaxSize() {
            assertThatCode(() -> imageValidator.validate(file("photo.jpg", "image/jpeg", (int) MAX_FILE_SIZE)))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("5MBを1バイト超えたら拒否する（上限の外）")
        void rejectsOneByteOverMaxSize() {
            assertThatThrownBy(() ->
                    imageValidator.validate(file("photo.jpg", "image/jpeg", (int) MAX_FILE_SIZE + 1)))
                    .isInstanceOf(InvalidImageException.class)
                    .hasMessageContaining("5MB");
        }

        @Test
        @DisplayName("サイズ0のファイルは、サイズを理由には拒否しない")
        void doesNotRejectEmptyFileBySize() {
            assertThatCode(() -> imageValidator.validate(file("photo.jpg", "image/jpeg", 0)))
                    .doesNotThrowAnyException();
        }
    }

    @Nested
    @DisplayName("拡張子の取り出し（extensionOf）")
    class ExtensionOf {

        @Test
        @DisplayName("ドットを含めて拡張子を返す")
        void returnsExtensionWithDot() {
            assertThat(imageValidator.extensionOf(file("photo.jpg", "image/jpeg", 1))).isEqualTo(".jpg");
        }

        @Test
        @DisplayName("ドットが複数あるときは最後のものを拡張子とする")
        void usesLastDot() {
            assertThat(imageValidator.extensionOf(file("my.photo.png", "image/png", 1))).isEqualTo(".png");
        }

        @Test
        @DisplayName("拡張子が無ければ空文字を返す（例外は投げない）")
        void returnsEmptyWhenNoExtension() {
            assertThat(imageValidator.extensionOf(file("photo", "image/jpeg", 1))).isEmpty();
        }

        @Test
        @DisplayName("ファイル名が未指定（null）でも空文字を返す")
        void returnsEmptyWhenFilenameIsNull() {
            MultipartFile fileWithoutName = new MockMultipartFile("image", null, "image/jpeg", new byte[1]);

            assertThat(imageValidator.extensionOf(fileWithoutName)).isEmpty();
        }
    }
}
