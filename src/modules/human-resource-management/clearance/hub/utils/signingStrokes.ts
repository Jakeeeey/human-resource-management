export interface SigningPoint {
    x: number;
    y: number;
}

export interface SigningStroke {
    points: SigningPoint[];
    width: number;
    color: string;
}

export interface SigningPage {
    page: number;
    strokes: SigningStroke[];
}

export interface SigningInk {
    pages: SigningPage[];
}

export function createEmptyPage(page: number): SigningPage {
    return { page, strokes: [] };
}

export function createEmptyInk(pageIndexes: number[]): SigningInk {
    return { pages: pageIndexes.map((page) => createEmptyPage(page)) };
}

export function isStrokeEmpty(stroke: SigningStroke | null | undefined): boolean {
    if (!stroke || !Array.isArray(stroke.points)) return true;
    return stroke.points.length === 0;
}

export function isStrokeListEmpty(strokes: readonly SigningStroke[] | null | undefined): boolean {
    if (!strokes || strokes.length === 0) return true;
    return strokes.every((stroke) => isStrokeEmpty(stroke));
}

export function isPageEmpty(page: SigningPage | null | undefined): boolean {
    if (!page) return true;
    return isStrokeListEmpty(page.strokes);
}

export function isInkEmpty(ink: SigningInk | null | undefined): boolean {
    if (!ink || !Array.isArray(ink.pages)) return true;
    return ink.pages.every((page) => isPageEmpty(page));
}

export function serializeInk(ink: SigningInk): string {
    return JSON.stringify(ink);
}

function isFinitePoint(point: unknown): point is SigningPoint {
    if (typeof point !== "object" || point === null) return false;
    const candidate = point as Record<string, unknown>;
    return (
        typeof candidate["x"] === "number" &&
        Number.isFinite(candidate["x"]) &&
        typeof candidate["y"] === "number" &&
        Number.isFinite(candidate["y"])
    );
}

export function parseInk(raw: string): SigningInk {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw) as unknown;
    } catch {
        throw new Error("INVALID_INK_PAYLOAD: body is not valid JSON");
    }
    if (typeof parsed !== "object" || parsed === null) {
        throw new Error("INVALID_INK_PAYLOAD: root must be an object");
    }
    const pages = (parsed as Record<string, unknown>)["pages"];
    if (!Array.isArray(pages)) {
        throw new Error("INVALID_INK_PAYLOAD: pages must be an array");
    }
    return {
        pages: pages.map((entry, pageIndex) => {
            if (typeof entry !== "object" || entry === null) {
                throw new Error(`INVALID_INK_PAYLOAD: pages[${pageIndex}] must be an object`);
            }
            const record = entry as Record<string, unknown>;
            if (typeof record["page"] !== "number" || !Number.isFinite(record["page"])) {
                throw new Error(`INVALID_INK_PAYLOAD: pages[${pageIndex}].page must be a number`);
            }
            if (!Array.isArray(record["strokes"])) {
                throw new Error(`INVALID_INK_PAYLOAD: pages[${pageIndex}].strokes must be an array`);
            }
            return {
                page: record["page"] as number,
                strokes: (record["strokes"] as unknown[]).map((strokeEntry, strokeIndex) => {
                    if (typeof strokeEntry !== "object" || strokeEntry === null) {
                        throw new Error(
                            `INVALID_INK_PAYLOAD: pages[${pageIndex}].strokes[${strokeIndex}] must be an object`
                        );
                    }
                    const strokeRecord = strokeEntry as Record<string, unknown>;
                    if (
                        !Array.isArray(strokeRecord["points"]) ||
                        !(strokeRecord["points"] as unknown[]).every(isFinitePoint)
                    ) {
                        throw new Error(
                            `INVALID_INK_PAYLOAD: pages[${pageIndex}].strokes[${strokeIndex}].points must be finite {x,y} pairs`
                        );
                    }
                    if (
                        typeof strokeRecord["width"] !== "number" ||
                        !Number.isFinite(strokeRecord["width"]) ||
                        (strokeRecord["width"] as number) <= 0
                    ) {
                        throw new Error(
                            `INVALID_INK_PAYLOAD: pages[${pageIndex}].strokes[${strokeIndex}].width must be a positive number`
                        );
                    }
                    if (typeof strokeRecord["color"] !== "string") {
                        throw new Error(
                            `INVALID_INK_PAYLOAD: pages[${pageIndex}].strokes[${strokeIndex}].color must be a string`
                        );
                    }
                    return {
                        points: (strokeRecord["points"] as SigningPoint[]).map((point) => ({
                            x: point.x,
                            y: point.y,
                        })),
                        width: strokeRecord["width"] as number,
                        color: strokeRecord["color"] as string,
                    };
                }),
            };
        }),
    };
}

export function scaleStroke(stroke: SigningStroke, scale: number): SigningStroke {
    return {
        points: stroke.points.map((point) => ({ x: point.x * scale, y: point.y * scale })),
        width: stroke.width * scale,
        color: stroke.color,
    };
}

export function scalePage(page: SigningPage, scale: number): SigningPage {
    return {
        page: page.page,
        strokes: page.strokes.map((stroke) => scaleStroke(stroke, scale)),
    };
}

export function scaleInk(ink: SigningInk, scale: number): SigningInk {
    return { pages: ink.pages.map((page) => scalePage(page, scale)) };
}

export function paintStrokeSegment(
    ctx: CanvasRenderingContext2D,
    from: SigningPoint,
    to: SigningPoint,
    width: number,
    color: string
): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
}

export function paintDot(
    ctx: CanvasRenderingContext2D,
    at: SigningPoint,
    width: number,
    color: string
): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(at.x, at.y, width / 2, 0, Math.PI * 2);
    ctx.fill();
}

export function paintStroke(ctx: CanvasRenderingContext2D, stroke: SigningStroke): void {
    if (isStrokeEmpty(stroke)) return;
    if (stroke.points.length === 1) {
        const only = stroke.points[0];
        if (only) paintDot(ctx, only, stroke.width, stroke.color);
        return;
    }
    for (let index = 1; index < stroke.points.length; index += 1) {
        const from = stroke.points[index - 1];
        const to = stroke.points[index];
        if (from && to) paintStrokeSegment(ctx, from, to, stroke.width, stroke.color);
    }
}

export interface ReplayOptions {
    scale?: number;
}

export function replayPage(
    ctx: CanvasRenderingContext2D,
    strokes: readonly SigningStroke[],
    options?: ReplayOptions
): void {
    const scale = options?.scale ?? 1;
    if (scale === 1) {
        for (const stroke of strokes) paintStroke(ctx, stroke);
        return;
    }
    ctx.save();
    ctx.scale(scale, scale);
    for (const stroke of strokes) paintStroke(ctx, stroke);
    ctx.restore();
}
