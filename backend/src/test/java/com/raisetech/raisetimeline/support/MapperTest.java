package com.raisetech.raisetimeline.support;

import org.mybatis.spring.boot.test.autoconfigure.MybatisTest;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.test.context.ActiveProfiles;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Inherited;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Mapper（MyBatis）の単体テストに付けるアノテーション。
 *
 * <p>同じ設定を6つのテストクラスに書き写すと、1か所直し忘れたときに
 * そこだけ挙動が変わる。設定はここに1つだけ置き、各テストは {@code @MapperTest} と書く。</p>
 *
 * <p>付けている設定の意味:</p>
 * <ul>
 *   <li>{@code @MybatisTest} … アプリ全体ではなく、DB と Mapper に関係する部品だけを読み込む。
 *       Controller や Security は起動しないため、{@code @SpringBootTest} より軽い。
 *       <strong>各テストの後に自動でロールバックされる</strong>ので、後片付けの TRUNCATE を書かなくてよい</li>
 *   <li>{@code @AutoConfigureTestDatabase(replace = NONE)} … <strong>必須。</strong>
 *       {@code @MybatisTest} は既定で接続先を「テスト用の組み込みDB」に差し替えようとする。
 *       このプロジェクトは H2 などを入れていないため、指定しないと
 *       「Failed to replace DataSource with an embedded database」で必ず失敗する。
 *       NONE を指定して、application-test.yml が指す実 PostgreSQL をそのまま使う</li>
 *   <li>{@code @ImportAutoConfiguration(FlywayAutoConfiguration.class)} … Flyway を明示的に動かす。
 *       {@code @MybatisTest} は読み込む部品を絞るため、これが無いとマイグレーションが走らない。
 *       CI のDBは空の状態から始まるので、Mapper のテストが先に実行されるとテーブルが無くて落ちる。
 *       <strong>他のテストが先に走ってくれること</strong>を当てにしない（テストは実行順に依存させない）</li>
 *   <li>{@code @ActiveProfiles("test")} … 接続先をテスト用DB {@code raisetimeline_test} にする。
 *       開発中に画面で見ているデータを壊さないため</li>
 * </ul>
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@MybatisTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ImportAutoConfiguration(FlywayAutoConfiguration.class)
@ActiveProfiles("test")
public @interface MapperTest {
}
