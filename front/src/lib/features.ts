// Public post details are part of the normal editor: location map, coordinates and baits.
// Keep them on by default so a production build without a frontend .env does not hide the map.
export const postLocationDetailsEnabled = import.meta.env.VITE_POST_LOCATION_DETAILS_ENABLED !== "false";

// The post -> public map spot moderation workflow is still a separate feature.
export const postMapLinkingEnabled = import.meta.env.VITE_POST_MAP_LINKING_ENABLED === "true";
