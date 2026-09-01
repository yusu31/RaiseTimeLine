package com.raisetech.raisetimeline.controller;

import com.raisetech.raisetimeline.request.ProfileUpdateRequest;
import com.raisetech.raisetimeline.response.PostListResponse;
import com.raisetech.raisetimeline.response.UserProfileResponse;
import com.raisetech.raisetimeline.response.UserResponse;
import com.raisetech.raisetimeline.response.UserSearchResultResponse;
import com.raisetech.raisetimeline.security.AuthenticatedUser;
import com.raisetech.raisetimeline.service.PostService;
import com.raisetech.raisetimeline.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final PostService postService;

    public UserController(UserService userService, PostService postService) {
        this.userService = userService;
        this.postService = postService;
    }

    /**
     * ユーザー検索。結果は閲覧者によって変わらないため認証ユーザーを受け取らない。
     * 認証必須であることは SecurityConfig の anyRequest().authenticated() が担保している。
     */
    @GetMapping
    public ResponseEntity<List<UserSearchResultResponse>> searchUsers(
            @RequestParam(name = "q", defaultValue = "") String q
    ) {
        return ResponseEntity.ok(userService.searchUsers(q));
    }

    @GetMapping("/{username}")
    public ResponseEntity<UserProfileResponse> getProfile(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String username
    ) {
        return ResponseEntity.ok(userService.getProfile(username, user.id()));
    }

    @GetMapping("/{username}/posts")
    public ResponseEntity<PostListResponse> getPosts(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String username,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Long authorId = userService.findByUsernameOrThrow(username).getId();
        return ResponseEntity.ok(postService.getPostsByAuthor(authorId, page, size, user.id()));
    }

    @PutMapping("/me")
    public ResponseEntity<UserResponse> updateProfile(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody ProfileUpdateRequest request
    ) {
        return ResponseEntity.ok(userService.updateProfile(user.id(), request));
    }

    @PostMapping(value = "/me/icon", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UserResponse> updateIcon(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam("image") MultipartFile image
    ) {
        return ResponseEntity.ok(userService.updateIcon(user.id(), image));
    }
}
