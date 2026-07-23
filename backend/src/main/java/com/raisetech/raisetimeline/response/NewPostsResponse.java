package com.raisetech.raisetimeline.response;

import java.util.List;

public record NewPostsResponse(List<PostResponse> posts, boolean hasMore) {
}
