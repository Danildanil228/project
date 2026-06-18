import { useRef, type ChangeEvent } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { mediaUrl } from "../lib/items-api";

type PhotoDropzoneProps = {
    photos: string[];
    onChange: (next: string[]) => void;
    onAddFiles: (files: File[]) => void | Promise<void>;
    uploading?: boolean;
    maxPhotos: number;
};

function PhotoItem({ url, index, onRemove }: { url: string; index: number; onRemove: () => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };
    return (
        <div ref={setNodeRef} style={style} className="group relative overflow-hidden rounded-lg border border-border bg-card">
            <img src={mediaUrl(url)} alt="" loading="lazy" className="aspect-square w-full object-cover" />
            <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-xs font-bold text-white">{index + 1}</span>
            {/* The drag handle — covers the whole image; remove button stays clickable above */}
            <button
                type="button"
                {...attributes}
                {...listeners}
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
                aria-label="Перетащить"
            />
            <button
                type="button"
                onClick={onRemove}
                className="absolute right-1 top-1 z-10 rounded bg-destructive/80 px-1.5 py-0.5 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
                ✕
            </button>
        </div>
    );
}

export function PhotoDropzone({ photos, onChange, onAddFiles, uploading, maxPhotos }: PhotoDropzoneProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = photos.indexOf(String(active.id));
        const newIndex = photos.indexOf(String(over.id));
        if (oldIndex < 0 || newIndex < 0) return;
        onChange(arrayMove(photos, oldIndex, newIndex));
    }

    function removeAt(index: number) {
        onChange(photos.filter((_, i) => i !== index));
    }

    async function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
        const files = Array.from(event.target.files ?? []);
        event.target.value = "";
        if (files.length) await onAddFiles(files);
    }

    function handleDrop(event: React.DragEvent<HTMLDivElement>) {
        event.preventDefault();
        const files = Array.from(event.dataTransfer.files ?? []).filter((file) => file.type.startsWith("image/"));
        if (files.length) void onAddFiles(files);
    }

    function preventDefault(event: React.DragEvent<HTMLDivElement>) {
        event.preventDefault();
    }

    const canAddMore = photos.length < maxPhotos;

    return (
        <div className="grid gap-3">
            {photos.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={photos} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {photos.map((url, index) => (
                                <PhotoItem key={url} url={url} index={index} onRemove={() => removeAt(index)} />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            {canAddMore && (
                <div
                    onDrop={handleDrop}
                    onDragOver={preventDefault}
                    onDragEnter={preventDefault}
                    className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card p-6 text-center transition-colors hover:border-primary"
                >
                    <p className="text-sm text-muted-foreground">Перетащите фотографии сюда</p>
                    <p className="text-xs text-muted-foreground">или</p>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                    >
                        + Добавить фото
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={handleInputChange}
                        className="hidden"
                    />
                    <p className="text-xs text-muted-foreground">PNG / JPG / WEBP / GIF — до 5 МБ каждая</p>
                </div>
            )}

            {uploading && <span className="text-xs text-muted-foreground">Загрузка…</span>}
        </div>
    );
}
