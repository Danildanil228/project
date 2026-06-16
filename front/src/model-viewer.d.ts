import type React from "react";
import type { ModelViewerElement } from "@google/model-viewer";

type ModelViewerProps = React.DetailedHTMLProps<React.HTMLAttributes<ModelViewerElement>, ModelViewerElement> & {
    src?: string;
    alt?: string;
    poster?: string;

    ar?: boolean;
    "camera-controls"?: boolean;
    "auto-rotate"?: boolean;
    "disable-zoom"?: boolean;

    exposure?: number | string;
    "shadow-intensity"?: number | string;
    "shadow-softness"?: number | string;
    "environment-image"?: string;

    orientation?: string;
    "camera-orbit"?: string;
    "camera-target"?: string;
    "field-of-view"?: string;
    "min-camera-orbit"?: string;
    "max-camera-orbit"?: string;

    loading?: "auto" | "lazy" | "eager";
    reveal?: "auto" | "interaction" | "manual";
    "interaction-prompt"?: "auto" | "none";
};

declare module "react" {
    namespace JSX {
        interface IntrinsicElements {
            "model-viewer": ModelViewerProps;
        }
    }
}

declare global {
    namespace JSX {
        interface IntrinsicElements {
            "model-viewer": ModelViewerProps;
        }
    }
}
