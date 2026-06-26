export type CoordinateBounds = {
    coordinateMinX: number;
    coordinateMinY: number;
    coordinateMaxX: number;
    coordinateMaxY: number;
};

type OptionalBounds = { [K in keyof CoordinateBounds]: number | null };

export function hasCoordinateBounds(value: OptionalBounds): value is CoordinateBounds {
    return value.coordinateMinX !== null
        && value.coordinateMinY !== null
        && value.coordinateMaxX !== null
        && value.coordinateMaxY !== null
        && value.coordinateMaxX > value.coordinateMinX
        && value.coordinateMaxY > value.coordinateMinY;
}

export function mapPercentToGame(mapX: number, mapY: number, bounds: CoordinateBounds) {
    return {
        x: bounds.coordinateMinX + (mapX / 100) * (bounds.coordinateMaxX - bounds.coordinateMinX),
        y: bounds.coordinateMinY + (1 - mapY / 100) * (bounds.coordinateMaxY - bounds.coordinateMinY),
    };
}

export function gameToMapPercent(x: number, y: number, bounds: CoordinateBounds) {
    return {
        mapX: ((x - bounds.coordinateMinX) / (bounds.coordinateMaxX - bounds.coordinateMinX)) * 100,
        mapY: (1 - (y - bounds.coordinateMinY) / (bounds.coordinateMaxY - bounds.coordinateMinY)) * 100,
    };
}
