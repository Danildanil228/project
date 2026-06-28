import { Link } from "react-router-dom";
import { mediaUrl, type CatalogItem, type ItemType } from "../lib/items-api";
import { LoadingImage } from "./LoadingImage";

type ItemCardProps = {
    type: ItemType;
    item: CatalogItem;
};

export function ItemCard({ type, item }: ItemCardProps) {
    return (
        <Link
            to={`/catalog/${type}/${item.id}`}
            className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary"
        >
            {item.photo ? (
                <LoadingImage
                    src={mediaUrl(item.photo)}
                    alt={item.name}
                    title={item.name}
                    className="aspect-[4/3] w-full"
                    imageClassName="object-contain"
                />
            ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-muted text-muted-foreground">
                    <span className="text-3xl font-bold uppercase">{item.name.slice(0, 2)}</span>
                </div>
            )}
            <div className="grid gap-1 p-3">
                <h3 className="font-bold leading-tight group-hover:text-primary">{item.name}</h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">{item.category}</span>
                    {item.lvl !== null && <span>Ур. {item.lvl}</span>}
                </div>
                <p className="text-sm text-muted-foreground">{item.brend}</p>
                {item.price_ser && <p className="text-sm font-medium">{item.price_ser} серебра</p>}
            </div>
        </Link>
    );
}
