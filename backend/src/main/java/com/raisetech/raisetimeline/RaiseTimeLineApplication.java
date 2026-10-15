package com.raisetech.raisetimeline;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

import java.util.TimeZone;

@SpringBootApplication
@MapperScan("com.raisetech.raisetimeline.mapper")
@ConfigurationPropertiesScan
public class RaiseTimeLineApplication {

    // 日時は「実行する機械の時計」に依存させず、常にUTCで保存・返却する(Issue #171)。
    // PostgreSQL JDBC ドライバはこの値をDBセッションの時刻設定に使うため、
    // CURRENT_TIMESTAMP も LocalDateTime.now() もUTCにそろう。
    // static ブロックなので main() だけでなく @SpringBootTest でもコンテキスト起動前に効く。
    static {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
    }

    public static void main(String[] args) {
        SpringApplication.run(RaiseTimeLineApplication.class, args);
    }
}
