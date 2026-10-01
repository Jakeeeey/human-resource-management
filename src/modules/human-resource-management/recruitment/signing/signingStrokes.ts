/**
 * Stroke-model primitives for the onboarding signing engine (Todo 3).
 *
 * Why this file exists: `InkCanvas` (per-page ink overlay) and the ported
 * `SignaturePad` share ONE stroke model and ONE paint path, so a stroke
 * serialized here and replayed at 1x is pixel-identical to the live drawing.
 * Todo 7 (tablet surface) consumes the model; Todo 8 (flatten) consumes the
 * PNG bytes produced from canvases painted through `paintStroke`.
 *
 * Stroke-JSON shape (contract — do not reshape without updating Todos 6-8):
 * `{ pages: [{ page: number, strokes: [{ points: [{ x, y }], width: number, color: string }] }] }`
 * Points live in canvas-bitmap space (the `width`/`height` bitmap attrs), so
 * replay at scale 1 with the same bitmap size is a 1:1 pixel match.
 */

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

/**
 * Builds an empty page shell for the given 1-based page number.
 * @param {number} page - 1-based page number.
 * @returns {SigningPage} Page with zero strokes.
 */
export function createEmptyPage(page: number): SigningPage {
    return { page, strokes: [] };
}

/**
 * Builds an empty ink document over the given 1-based page numbers.
 * @param {number[]} pageIndexes - 1-based page numbers to include.
 * @returns {SigningInk} Ink document with one empty page per number.
 */
export function createEmptyInk(pageIndexes: number[]): SigningInk {
    return { pages: pageIndexes.map((page) => createEmptyPage(page)) };
}

/**
 * True when a stroke carries no drawable mark (null, empty, or point-less).
 * @param {SigningStroke | null | undefined} stroke - Stroke to inspect.
 * @returns {boolean} True when there is nothing to paint.
 */
export function isStrokeEmpty(stroke: SigningStroke | null | undefined): boolean {
    if (!stroke || !Array.isArray(stroke.points)) return true;
    return stroke.points.length === 0;
}

/**
 * True when a stroke list carries no drawable mark. This is the empty-ink
 * detector used by `InkCanvas` and `SignaturePad` before any PNG export —
 * an empty pad must reject export (resolve null) instead of filing a blank.
 * @param {readonly SigningStroke[] | null | undefined} strokes - Strokes to inspect.
 * @returns {boolean} True when no stroke holds a point.
 */
export function isStrokeListEmpty(
    strokes: readonly SigningStroke[] | null | undefined
): boolean {
    if (!strokes || strokes.length === 0) return true;
    return strokes.every((stroke) => isStrokeEmpty(stroke));
}

/**
 * True when a page carries no drawable mark.
 * @param {SigningPage | null | undefined} page - Page to inspect.
 * @returns {boolean} True when the page has no ink.
 */
export function isPageEmpty(page: SigningPage | null | undefined): boolean {
    if (!page) return true;
    return isStrokeListEmpty(page.strokes);
}

/**
 * True when a whole ink document carries no drawable mark.
 * @param {SigningInk | null | undefined} ink - Ink document to inspect.
 * @returns {boolean} True when every page is empty.
 */
export function isInkEmpty(ink: SigningInk | null | undefined): boolean {
    if (!ink || !Array.isArray(ink.pages)) return true;
    return ink.pages.every((page) => isPageEmpty(page));
}

/**
 * Serializes an ink document to its stroke-JSON string form for server
 * draft persistence (Todo 7 Save-draft) and envelope artifacts.
 * @param {SigningInk} ink - Ink document to serialize.
 * @returns {string} Canonical JSON string of the stroke model.
 */
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

/**
 * Parses stroke JSON back into an ink document, validating the full shape.
 * Malformed payloads throw (never silently yield a half-document that could
 * file a corrupt envelope); callers map this to a 400 with reason.
 * @param {string} raw - JSON string produced by `serializeInk`.
 * @returns {SigningInk} Validated ink document (deep-cloned from the payload).
 */
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

/**
 * Scales one stroke's points by a uniform factor (flatten path reuses this
 * when the export bitmap differs from the capture bitmap).
 * @param {SigningStroke} stroke - Stroke to scale.
 * @param {number} scale - Uniform scale factor (1 = identity, pixel-exact).
 * @returns {SigningStroke} New stroke with scaled points.
 */
export function scaleStroke(stroke: SigningStroke, scale: number): SigningStroke {
    return {
        points: stroke.points.map((point) => ({ x: point.x * scale, y: point.y * scale })),
        width: stroke.width * scale,
        color: stroke.color,
    };
}

/**
 * Scales every stroke on a page by a uniform factor.
 * @param {SigningPage} page - Page to scale.
 * @param {number} scale - Uniform scale factor (1 = identity, pixel-exact).
 * @returns {SigningPage} New page with scaled strokes.
 */
export function scalePage(page: SigningPage, scale: number): SigningPage {
    return {
        page: page.page,
        strokes: page.strokes.map((stroke) => scaleStroke(stroke, scale)),
    };
}

/**
 * Scales a whole ink document by a uniform factor.
 * @param {SigningInk} ink - Ink document to scale.
 * @param {number} scale - Uniform scale factor (1 = identity, pixel-exact).
 * @returns {SigningInk} New ink document with scaled strokes.
 */
export function scaleInk(ink: SigningInk, scale: number): SigningInk {
    return { pages: ink.pages.map((page) => scalePage(page, scale)) };
}

/**
 * Paints ONE live segment. Both the live pointer path and `paintStroke`
 * (replay) funnel through this function, so serialize→replay at 1x is
 * pixel-identical by construction — there is no second paint path to drift.
 * @param {CanvasRenderingContext2D} ctx - Target 2d context.
 * @param {SigningPoint} from - Segment start in bitmap space.
 * @param {SigningPoint} to - Segment end in bitmap space.
 * @param {number} width - Stroke width in bitmap px.
 * @param {string} color - Stroke color (bitmap ink stays dark; dark-mode
 * display inversion is CSS-only and never touches exported bytes).
 * @returns {void}
 */
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

/**
 * Paints a tap (single-point stroke) as a filled dot.
 * @param {CanvasRenderingContext2D} ctx - Target 2d context.
 * @param {SigningPoint} at - Dot center in bitmap space.
 * @param {number} width - Dot diameter basis in bitmap px.
 * @param {string} color - Dot color.
 * @returns {void}
 */
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

/**
 * Replays one stroke exactly as the live path painted it: segment by
 * segment through `paintStrokeSegment` (single-point strokes via `paintDot`).
 * @param {CanvasRenderingContext2D} ctx - Target 2d context.
 * @param {SigningStroke} stroke - Stroke to replay.
 * @returns {void}
 */
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
    /** Uniform scale; default 1 (identity — no transform applied, pixel-exact). */
    scale?: number;
}

/**
 * Replays a page's strokes onto a context (draft restore, PNG export,
 * fidelity checks). At the default scale 1 NO transform is applied, so the
 * replayed bitmap matches the live capture pixel for pixel.
 * @param {CanvasRenderingContext2D} ctx - Target 2d context.
 * @param {readonly SigningStroke[]} strokes - Strokes to replay.
 * @param {ReplayOptions} options - Optional uniform scale.
 * @returns {void}
 */
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
