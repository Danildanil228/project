import type { Reel } from "../types/reel";

export function ReelCard({ reel }: { reel: Reel }) {
    return (
        <div className="reel-card flex gap-20">
            <div className="h-100! w-100! border-4">
                <model-viewer
                    src={reel.model ? `/${reel.model}` : ""}
                    alt={reel.name}
                    orientation="0deg 180deg 0deg"
                    camera-controls
                    auto-rotate
                    shadow-intensity="0"
                    exposure="1"
                    environment-image="neutral"
                    style={{ width: "100%", height: "100%" }}
                />
            </div>
            <div>
                <h3 className="text-2xl! uppercase">{reel.name}</h3>
                <p>Бренд: {reel.brend}</p>
                <p>Тип: {reel.category}</p>
                <p>Тест: {reel.test}</p>
                <p>Уровень: {reel.lvl}</p>
            </div>
        </div>
    );
}
