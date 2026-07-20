package com.raisetech.raisetimeline;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@MapperScan("com.raisetech.raisetimeline.mapper")
@ConfigurationPropertiesScan
public class RaiseTimeLineApplication {

    public static void main(String[] args) {
        SpringApplication.run(RaiseTimeLineApplication.class, args);
    }
}
