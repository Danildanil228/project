export const fishingMethods = ["Поплавок", "Донка", "Спиннинг", "Морская"] as const;
export type FishingMethod = (typeof fishingMethods)[number];

export type PostStatus = "draft" | "pending" | "in_review" | "approved" | "rejected" | "deleted";

export const postStatusLabels: Record<PostStatus, string> = {
    draft: "Черновик",
    pending: "Ожидает проверки",
    in_review: "На модерации",
    approved: "Опубликован",
    rejected: "Отклонён",
    deleted: "Удалён",
};

export type CatchRow = {
    id: number;
    fishId: number;
    fishName: string;
    rarity: string;
    baits: Array<{ id: number; name: string; kind: string }>;
};

export type MediaRow = {
    id: number;
    url: string;
    orderIndex: number;
};

export type PostVersion = {
    id: number;
    versionNumber: number;
    description: string | null;
    point: string | null;
    fishingMethod: FishingMethod | null;
    income: number | null;
    fishingMinutes: number | null;
    incomePerHour: number | null;
    waterbodyId: number | null;
    waterbodyName: string | null;
    proposedSpotId: number | null;
    mapX: number | null;
    mapY: number | null;
    gameCoordinateX: number | null;
    gameCoordinateY: number | null;
    baitMode: "common" | "per_fish";
    commonBaits: Array<{ id: number; name: string; kind: string }>;
    catches: CatchRow[];
    media: MediaRow[];
};

export type PostDetail = {
    id: number;
    authorId: string;
    status: PostStatus;
    currentVersionId: number | null;
    rejectionReason: string | null;
    resubmitCount: number;
    viewCount: number;
    pinnedAt: string | null;
    createdAt: string;
    publishedAt: string | null;
    authorName: string;
    authorImage: string | null;
    version: PostVersion | null;
};

// Row shape returned by GET /api/posts/mine
export type MyPostRow = {
    id: number;
    status: PostStatus;
    createdAt: string;
    publishedAt: string | null;
    rejectionReason: string | null;
    description: string | null;
    waterbodyName: string | null;
    coverUrl: string | null;
};

// Editor payload pieces
export type CatchInput = {
    fishId: number;
    baitIds: number[];
};

export type PostContentInput = {
    description: string;
    waterbodyId: number | null;
    point: string | null;
    fishingMethod: FishingMethod | null;
    income: number | null;
    fishingMinutes: number | null;
    catches: CatchInput[];
    baitMode: "common" | "per_fish";
    commonBaitIds: number[];
    proposedSpotId: number | null;
    mapX: number | null;
    mapY: number | null;
    gameCoordinateX: number | null;
    gameCoordinateY: number | null;
    media: string[];
};

export type CreatePostInput = PostContentInput & {
    submit: boolean;
    skipModeration?: boolean;
};

export type FeedSort = "date" | "incomePerHour";

// Card shape returned by the public feed and the author profile.
export type FeedItem = {
    id: number;
    publishedAt: string | null;
    authorId: string;
    authorName: string;
    authorImage: string | null;
    description: string | null;
    point: string | null;
    fishingMethod: FishingMethod | null;
    income: number | null;
    fishingMinutes: number | null;
    incomePerHour: number | null;
    waterbodyName: string | null;
    mediaUrls: string[];
    catchCount: number;
    fishNames: string[];
    likes: number;
    dislikes: number;
    viewCount: number;
    pinnedAt: string | null;
};

export type CommentRow = {
    id: number;
    body: string;
    createdAt: string;
    authorId: string;
    authorName: string | null;
    authorImage: string | null;
};

export type ReactionSummary = {
    likes: number;
    dislikes: number;
    mine: 1 | -1 | 0;
};

export type NotificationType = "comment" | "post_approved" | "post_rejected" | "post_removed" | "moderation_new" | "report_new" | "map_submission_new" | "map_submission_approved" | "map_submission_rejected";

export type NotificationRow = {
    id: number;
    type: NotificationType;
    postId: number | null;
    actorId: string | null;
    actorName: string | null;
    data: Record<string, unknown>;
    readAt: string | null;
    createdAt: string;
};

export type ReportStatus = "open" | "resolved" | "rejected";

export type ReportRow = {
    id: number;
    postId: number;
    reason: string;
    status: ReportStatus;
    createdAt: string;
    resolvedAt: string | null;
    resolvedByName: string | null;
    reporterId: string;
    reporterName: string | null;
    postStatus: string;
    postAuthorName: string | null;
    postDescription: string | null;
    openReportsForPost: number;
};

export type ModerationQueueRow = {
    id: number;
    status: "pending" | "in_review";
    claimedById: string | null;
    claimedByName: string | null;
    claimedAt: string | null;
    createdAt: string;
    updatedAt: string;
    resubmitCount: number;
    claimExpired: boolean;
    authorId: string;
    authorName: string;
    description: string | null;
    fishingMethod: FishingMethod | null;
    waterbodyName: string | null;
    coverUrl: string | null;
    catchCount: number;
};

export type AuthorProfile = {
    author: {
        id: string;
        name: string;
        image: string | null;
        role: string | string[] | null;
        createdAt: string;
    };
    stats: { postCount: number; totalIncome: number };
    posts: FeedItem[];
    limit: number;
    offset: number;
};
