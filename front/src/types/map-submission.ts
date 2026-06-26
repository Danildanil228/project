export type MapSubmissionStatus = "pending" | "approved" | "rejected";

export type MapSubmissionTarget = {
    id: number;
    fishId: number;
    fishName: string;
    baits: Array<{ id: number; name: string }>;
};

export type MapSubmission = {
    id: number;
    postId: number;
    status: MapSubmissionStatus;
    proposedSpotId: number | null;
    waterbodyId: number;
    waterbodyName: string;
    mapX: number;
    mapY: number;
    gameCoordinateX: number;
    gameCoordinateY: number;
    createdAt: string;
    authorId: string;
    authorName: string;
    description: string | null;
    targets: MapSubmissionTarget[];
};

export type MapSubmissionApproval = {
    spotId: number | null;
    name: string;
    mapX: number;
    mapY: number;
    gameCoordinateX: number;
    gameCoordinateY: number;
    targets: Array<{ fishId: number; baitIds: number[] }>;
};
