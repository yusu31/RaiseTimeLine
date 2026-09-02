package com.raisetech.raisetimeline.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

/**
 * S3モード（{@code app.storage.type=s3}）でのみ {@link S3Client} を登録する設定。
 *
 * <p>ローカル保存モードではこのクラスごと無効になるため、AWSの認証情報が無い環境でも起動できる。</p>
 */
@Configuration
@ConditionalOnProperty(name = "app.storage.type", havingValue = "s3")
public class S3Config {

    /**
     * {@link DefaultCredentialsProvider} は「環境変数 → プロファイル（{@code ~/.aws}） → EC2のIAMロール」の順に
     * 認証情報を自動で探す。この仕組みのおかげで、ローカル検証・EC2の双方でコードを変えずに済む。
     *
     * <p>{@code create()} ではなく {@code builder().build()} を使うのは、前者が非推奨のため。
     * {@code create()} は共有のシングルトンを返すが、このクラスは {@code SdkAutoCloseable} であり、
     * どこかが閉じると他の利用箇所まで巻き込まれる。</p>
     */
    @Bean
    public S3Client s3Client(@Value("${app.storage.s3.region}") String region) {
        return S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(DefaultCredentialsProvider.builder().build())
                .build();
    }
}
