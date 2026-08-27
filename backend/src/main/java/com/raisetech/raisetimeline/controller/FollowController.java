package com.raisetech.raisetimeline.controller;

import com.raisetech.raisetimeline.response.FollowStatusResponse;
import com.raisetech.raisetimeline.response.FollowUserResponse;
import com.raisetech.raisetimeline.security.AuthenticatedUser;
import com.raisetech.raisetimeline.service.FollowService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/users/{username}")
public class FollowController {

    private final FollowService followService;

    public FollowController(FollowService followService) {
        this.followService = followService;
    }

    @PostMapping("/follow")
    public ResponseEntity<FollowStatusResponse> follow(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String username
    ) {
        return ResponseEntity.ok(followService.follow(user.id(), username));
    }

    @DeleteMapping("/follow")
    public ResponseEntity<FollowStatusResponse> unfollow(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String username
    ) {
        return ResponseEntity.ok(followService.unfollow(user.id(), username));
    }

    @GetMapping("/following")
    public ResponseEntity<List<FollowUserResponse>> following(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String username
    ) {
        return ResponseEntity.ok(followService.getFollowing(username, user.id()));
    }

    @GetMapping("/followers")
    public ResponseEntity<List<FollowUserResponse>> followers(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String username
    ) {
        return ResponseEntity.ok(followService.getFollowers(username, user.id()));
    }
}
