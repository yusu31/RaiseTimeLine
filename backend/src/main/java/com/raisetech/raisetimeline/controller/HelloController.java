package com.raisetech.raisetimeline.controller;

import com.raisetech.raisetimeline.response.HelloResponse;
import com.raisetech.raisetimeline.security.AuthenticatedUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HelloController {

    @GetMapping("/api/hello")
    public HelloResponse hello(@AuthenticationPrincipal AuthenticatedUser user) {
        return new HelloResponse("Hello, " + user.displayName() + "さん！ログイン認証に成功しました。");
    }
}
