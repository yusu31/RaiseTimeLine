package com.raisetech.raisetimeline.response;

import java.util.List;

public record PostListResponse(
        List<PostResponse> posts,
        int page,
        boolean hasNext
) {
}
