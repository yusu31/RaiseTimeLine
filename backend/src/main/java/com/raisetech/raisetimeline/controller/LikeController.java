package com.raisetech.raisetimeline.controller;

import com.raisetech.raisetimeline.response.LikeStatusResponse;
import com.raisetech.raisetimeline.security.AuthenticatedUser;
import com.raisetech.raisetimeline.service.LikeService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/posts/{postId}/likes")
public class LikeController {

    private final LikeService likeService;

    public LikeController(LikeService likeService) {
        this.likeService = likeService;
    }

    @PostMapping
    public ResponseEntity<LikeStatusResponse> like(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long postId
    ) {
        return ResponseEntity.ok(likeService.like(user.id(), postId));
    }

    @DeleteMapping
    public ResponseEntity<LikeStatusResponse> unlike(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long postId
    ) {
        return ResponseEntity.ok(likeService.unlike(user.id(), postId));
    }
}
