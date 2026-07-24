package com.raisetech.raisetimeline.controller;

import com.raisetech.raisetimeline.request.PostCreateRequest;
import com.raisetech.raisetimeline.request.PostUpdateRequest;
import com.raisetech.raisetimeline.response.NewPostsCountResponse;
import com.raisetech.raisetimeline.response.NewPostsResponse;
import com.raisetech.raisetimeline.response.PostListResponse;
import com.raisetech.raisetimeline.response.PostResponse;
import com.raisetech.raisetimeline.security.AuthenticatedUser;
import com.raisetech.raisetimeline.service.PostService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/posts")
public class PostController {

    private final PostService postService;

    public PostController(PostService postService) {
        this.postService = postService;
    }

    @GetMapping
    public ResponseEntity<PostListResponse> list(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(postService.getTimeline(page, size, user.id()));
    }

    @GetMapping("/new-count")
    public ResponseEntity<NewPostsCountResponse> newPostsCount(
            @RequestParam(defaultValue = "0") long afterId
    ) {
        return ResponseEntity.ok(postService.getNewPostsCount(afterId));
    }

    @GetMapping("/new")
    public ResponseEntity<NewPostsResponse> newPosts(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(defaultValue = "0") long afterId
    ) {
        return ResponseEntity.ok(postService.getNewPosts(afterId, user.id()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PostResponse> get(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(postService.getPost(id, user.id()));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PostResponse> create(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam("content") String content,
            @RequestParam(value = "image", required = false) MultipartFile image
    ) {
        PostResponse response = postService.create(user.id(), new PostCreateRequest(content, image));
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<PostResponse> update(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @Valid @RequestBody PostUpdateRequest request
    ) {
        return ResponseEntity.ok(postService.update(user.id(), id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id
    ) {
        postService.delete(user.id(), id);
        return ResponseEntity.ok().build();
    }
}
