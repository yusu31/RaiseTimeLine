package com.raisetech.raisetimeline.service;

import com.raisetech.raisetimeline.exception.InvalidImageException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Utilities;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link S3StorageService} のテスト。
 *
 * <p>S3Client をモックに差し替え、<strong>実際のAWSには一切接続しない</strong>。
 * 実S3を叩くと、ビルドのたびに課金が発生し、ネットワーク不通でテストが落ち、
 * CI用の認証情報の管理まで必要になるため。</p>
 */
@ExtendWith(MockitoExtension.class)
class S3StorageServiceTest {

    private static final String BUCKET = "raisetimeline-test-bucket";

    @Mock
    private S3Client s3Client;

    private S3StorageService createService() {
        return new S3StorageService(s3Client, new ImageValidator(), BUCKET);
    }

    private MockMultipartFile jpegFile() {
        return new MockMultipartFile("image", "photo.jpg", "image/jpeg", "dummy-image-content".getBytes());
    }

    @Test
    @DisplayName("store: 指定したバケットへ、UUID+拡張子のキーとContent-Type付きで保存する")
    void storeUploadsWithExpectedBucketKeyAndContentType() {
        S3StorageService service = createService();

        String key = service.store(jpegFile());

        ArgumentCaptor<PutObjectRequest> captor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3Client).putObject(captor.capture(), any(RequestBody.class));

        PutObjectRequest request = captor.getValue();
        assertThat(request.bucket()).isEqualTo(BUCKET);
        assertThat(request.contentType()).isEqualTo("image/jpeg");
        assertThat(request.key()).isEqualTo(key);
        // キーは「UUID + 元ファイルの拡張子」。元のファイル名は使わない（同名衝突と日本語ファイル名を避けるため）
        assertThat(key).endsWith(".jpg").hasSize(36 + 4);
        assertThat(key).doesNotContain("photo");
    }

    @Test
    @DisplayName("store: 呼ぶたびに異なるキーになる（同名ファイルでも上書きされない）")
    void storeGeneratesUniqueKeyForEachCall() {
        S3StorageService service = createService();

        String firstKey = service.store(jpegFile());
        String secondKey = service.store(jpegFile());

        assertThat(firstKey).isNotEqualTo(secondKey);
    }

    @Test
    @DisplayName("store: 許可されていない形式は保存せず InvalidImageException を投げる")
    void storeRejectsUnsupportedContentType() {
        S3StorageService service = createService();
        MockMultipartFile textFile =
                new MockMultipartFile("image", "note.txt", "text/plain", "not an image".getBytes());

        assertThatThrownBy(() -> service.store(textFile))
                .isInstanceOf(InvalidImageException.class);

        // 検証で弾かれた場合、S3への通信そのものが発生しないこと
        verify(s3Client, never()).putObject(any(PutObjectRequest.class), any(RequestBody.class));
    }

    @Test
    @DisplayName("toPublicUrl: バケットとキーから公開URLを組み立てる")
    void toPublicUrlBuildsUrlFromBucketAndKey() {
        when(s3Client.utilities()).thenReturn(S3Utilities.builder().region(Region.AP_NORTHEAST_1).build());
        S3StorageService service = createService();

        String url = service.toPublicUrl("abc-123.jpg");

        assertThat(url).startsWith("https://").contains(BUCKET).endsWith("/abc-123.jpg");
    }

    @Test
    @DisplayName("delete: 指定したバケットとキーで削除を要求する")
    void deleteRequestsExpectedBucketAndKey() {
        S3StorageService service = createService();

        service.delete("abc-123.jpg");

        ArgumentCaptor<DeleteObjectRequest> captor = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(s3Client).deleteObject(captor.capture());
        assertThat(captor.getValue().bucket()).isEqualTo(BUCKET);
        assertThat(captor.getValue().key()).isEqualTo("abc-123.jpg");
    }

    @Test
    @DisplayName("バケット名が未設定なら起動時点で失敗する（投稿時まで不具合が隠れないようにするため）")
    void constructorFailsFastWhenBucketIsNotConfigured() {
        ImageValidator validator = new ImageValidator();

        assertThatThrownBy(() -> new S3StorageService(s3Client, validator, ""))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("app.storage.s3.bucket");
    }
}
