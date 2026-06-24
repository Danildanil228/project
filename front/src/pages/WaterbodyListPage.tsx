import { Map, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { mediaUrl } from "../lib/items-api";
import { listWaterbodies } from "../lib/reference-api";
import type { WaterbodyListRow } from "../types/waterbody";
import { getErrorMessage } from "../utils/admin-format";

function pluralize(count: number, one: string, few: string, many: string) {
    const mod100 = count % 100;
    const mod10 = count % 10;
    const word = mod100 >= 11 && mod100 <= 14 ? many : mod10 === 1 ? one : mod10 >= 2 && mod10 <= 4 ? few : many;
    return `${count} ${word}`;
}

export function WaterbodyListPage() {
    const [items, setItems] = useState<WaterbodyListRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        listWaterbodies({ limit: 500 })
            .then((response) => setItems(response.items))
            .catch((caught) => setError(getErrorMessage(caught)))
            .finally(() => setLoading(false));
    }, []);

    return (
        <section className="grid gap-5">
            <PageHeader
                eyebrow="Карты"
                title="Водоёмы и точки ловли"
                description="Выберите водоём, чтобы посмотреть отмеченные точки, рыбу и рабочие приманки."
            />

            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            {loading ? (
                <p className="py-10 text-center text-muted-foreground">Загрузка…</p>
            ) : items.length === 0 ? (
                <div className="border-y border-border py-12 text-center text-muted-foreground">
                    <Map className="mx-auto mb-3" size={32} />
                    Водоёмы пока не добавлены
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((item) => (
                        <Link key={item.id} to={`/waterbodies/${item.id}`} className="overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary">
                            {item.photo ? (
                                <img src={mediaUrl(item.photo)} alt="" className="aspect-[16/8] w-full object-cover" />
                            ) : (
                                <div className="grid aspect-[16/8] place-items-center bg-muted text-muted-foreground"><Map size={30} /></div>
                            )}
                            <div className="p-4">
                                <h3 className="font-bold">{item.name}</h3>
                                <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                                    <span>{pluralize(item.fishCount, "вид рыбы", "вида рыбы", "видов рыб")}</span>
                                    <span className="inline-flex items-center gap-1"><MapPin size={14} /> {pluralize(item.spotCount, "точка", "точки", "точек")}</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </section>
    );
}
