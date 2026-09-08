package com.raisetech.raisetimeline.service;

import com.raisetech.raisetimeline.exception.InvalidImageException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * {@link LocalStorageService} のテスト。
 *
 * <p>ここだけはモックを使わず<strong>実際にファイルを書き込む</strong>。
 * 「ファイルを保存する」処理をモックにすると、保存できたことにする処理をテストするだけになり、
 * 検証の意味が無くなるため。{@code @TempDir} を使うと、テストごとに一時ディレクトリが作られ、
 * 終了後に自動で消えるので、後片付けを書かなくてよい。</p>
 */
class LocalStorageServiceTest {

    @TempDir
    Path tempDir;

    private LocalStorageService createService() {
        return new LocalStorageService(tempDir.toString(), new ImageValidator());
    }

    private MultipartFile jpegFile(String filename) {
        return new MockMultipartFile("image", filename, "image/jpeg", "dummy-image-content".getBytes());
    }

    @Test
    @DisplayName("store: ファイルを保存し、UUID + 元の拡張子 のファイル名を返す")
    void storeSavesFileWithGeneratedName() {
        LocalStorageService service = createService();

        String storedName = service.store(jpegFile("photo.jpg"));

        // UUID は36文字。それに ".jpg" が付く
        assertThat(storedName).hasSize(36 + 4).endsWith(".jpg");
        assertThat(tempDir.resolve(storedName)).exists();
    }

    @Test
    @DisplayName("store: 元のファイル名は保存名に使わない（同名衝突と日本語ファイル名を避けるため）")
    void storeDoesNotUseOriginalFilename() {
        LocalStorageService service = createService();

        String storedName = service.store(jpegFile("写真.jpg"));

        assertThat(storedName).doesNotContain("写真");
    }

    @Test
    @DisplayName("store: 同じ名前のファイルを2回保存しても、別のファイルとして両方残る")
    void storeGeneratesUniqueNameForEachCall() {
        LocalStorageService service = createService();

        String first = service.store(jpegFile("photo.jpg"));
        String second = service.store(jpegFile("photo.jpg"));

        assertThat(first).isNotEqualTo(second);
        assertThat(tempDir.resolve(first)).exists();
        assertThat(tempDir.resolve(second)).exists();
    }

    @Test
    @DisplayName("store: 保存した内容が元のファイルと一致する")
    void storeWritesOriginalContent() throws IOException {
        LocalStorageService service = createService();

        String storedName = service.store(jpegFile("photo.jpg"));

        assertThat(Files.readString(tempDir.resolve(storedName))).isEqualTo("dummy-image-content");
    }

    @Test
    @DisplayName("store: 許可されていない形式は保存せず InvalidImageException を投げる（ファイルも作られない）")
    void storeRejectsUnsupportedFormat() throws IOException {
        LocalStorageService service = createService();
        MultipartFile textFile = new MockMultipartFile("image", "note.txt", "text/plain", "not an image".getBytes());

        assertThatThrownBy(() -> service.store(textFile))
                .isInstanceOf(InvalidImageException.class);

        // 例外が出ることだけでなく、ゴミファイルが残っていないことまで確認する
        try (var files = Files.list(tempDir)) {
            assertThat(files).isEmpty();
        }
    }

    @Test
    @DisplayName("toPublicUrl: 保存名から /uploads/ 付きの公開URLを組み立てる")
    void toPublicUrlPrefixesUploadsPath() {
        LocalStorageService service = createService();

        assertThat(service.toPublicUrl("abc-123.jpg")).isEqualTo("/uploads/abc-123.jpg");
    }

    @Test
    @DisplayName("delete: 保存したファイルを削除できる")
    void deleteRemovesStoredFile() {
        LocalStorageService service = createService();
        String storedName = service.store(jpegFile("photo.jpg"));

        service.delete(storedName);

        assertThat(tempDir.resolve(storedName)).doesNotExist();
    }

    @Test
    @DisplayName("delete: 存在しないファイルを削除しても例外を投げない（アイコン差し替えを失敗させないため）")
    void deleteDoesNotThrowForMissingFile() {
        LocalStorageService service = createService();

        // 削除は「後片付け」であり、失敗しても本来の処理（DB更新）は完了している。
        // ここで例外を投げると、成功したはずの操作がエラー扱いになってしまう
        assertThatCode(() -> service.delete("存在しないファイル.jpg")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("保存先ディレクトリが無ければ、起動時に自動で作成する")
    void createsUploadDirectoryOnStartup() {
        Path notCreatedYet = tempDir.resolve("nested/uploads");

        new LocalStorageService(notCreatedYet.toString(), new ImageValidator());

        assertThat(notCreatedYet).isDirectory();
    }
}
