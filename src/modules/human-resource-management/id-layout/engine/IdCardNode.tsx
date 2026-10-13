import type { CSSProperties } from "react";
import { Image as ImageIcon } from "lucide-react";
import type { IdNode } from "../types/id-layout.schema";
import { sanitizeIdInlineHtml } from "./sanitize";

export const ID_MISSING_VALUE = "____";

const ID_CLIP_DIAMOND = "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
const ID_CLIP_PENTAGON = "polygon(50% 0%, 100% 38%, 81% 100%, 19% 100%, 0% 38%)";
const ID_CLIP_HEXAGON = "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
const ID_CLIP_STAR = "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";
const ID_CLIP_ARROW = "polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)";

export interface IdCardNodeProps {
    readonly node: IdNode;
    readonly values?: Readonly<Record<string, string>>;
}

function propOf(props: unknown, key: string): unknown {
    if (typeof props !== "object" || props === null) return undefined;
    return (props as Readonly<Record<string, unknown>>)[key];
}

function textProp(props: unknown, key: string): string | undefined {
    const value = propOf(props, key);
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function numberProp(props: unknown, key: string): number | undefined {
    const value = propOf(props, key);
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function alignProp(props: unknown): "left" | "center" | "right" | undefined {
    const value = propOf(props, "align");
    return value === "left" || value === "center" || value === "right" ? value : undefined;
}

function idTextStyle(props: unknown): CSSProperties {
    const style: CSSProperties = {};
    const fontFamily = textProp(props, "fontFamily");
    if (fontFamily !== undefined) style.fontFamily = fontFamily;
    const fontSize = numberProp(props, "fontSize");
    if (fontSize !== undefined && fontSize > 0) style.fontSize = fontSize;
    const fontWeight = propOf(props, "fontWeight");
    if (typeof fontWeight === "number" && Number.isFinite(fontWeight) && fontWeight > 0) {
        style.fontWeight = fontWeight;
    } else if (fontWeight === "normal" || fontWeight === "bold") {
        style.fontWeight = fontWeight;
    }
    if (propOf(props, "italic") === true) style.fontStyle = "italic";
    const underline = propOf(props, "underline") === true;
    const strikethrough = propOf(props, "strikethrough") === true;
    if (underline && strikethrough) style.textDecorationLine = "underline line-through";
    else if (underline) style.textDecorationLine = "underline";
    else if (strikethrough) style.textDecorationLine = "line-through";
    const color = textProp(props, "color");
    if (color !== undefined) style.color = color;
    const align = alignProp(props);
    if (align !== undefined) style.textAlign = align;
    const letterSpacing = numberProp(props, "letterSpacing");
    if (letterSpacing !== undefined) style.letterSpacing = letterSpacing;
    const lineHeight = propOf(props, "lineHeight");
    if (typeof lineHeight === "number" && Number.isFinite(lineHeight) && lineHeight > 0) {
        style.lineHeight = lineHeight;
    } else if (typeof lineHeight === "string" && lineHeight.trim().length > 0) {
        style.lineHeight = lineHeight.trim();
    }
    const strokeWidth = numberProp(props, "strokeWidth");
    const strokeColor = textProp(props, "strokeColor");
    if (strokeWidth !== undefined && strokeWidth > 0 && strokeColor !== undefined) {
        style.WebkitTextStroke = `${strokeWidth}px ${strokeColor}`;
    }
    return style;
}

export function idNodeText(node: IdNode): string {
    const raw = propOf(node.props, "text");
    return typeof raw === "string" ? raw : "";
}

function IdTextBody({ node }: { readonly node: IdNode }) {
    return (
        <div
            className="h-full w-full overflow-hidden"
            dangerouslySetInnerHTML={{ __html: sanitizeIdInlineHtml(idNodeText(node)) }}
            style={idTextStyle(node.props)}
        />
    );
}

function IdVariableBody({ node }: { readonly node: IdNode }) {
    const field = textProp(node.props, "field") ?? "";
    const transform = propOf(node.props, "transform");
    const shaped = transform === "upper" ? field.toUpperCase() : transform === "lower" ? field.toLowerCase() : field;
    const prefixValue = propOf(node.props, "prefix");
    const prefix = typeof prefixValue === "string" ? prefixValue : "";
    const suffixValue = propOf(node.props, "suffix");
    const suffix = typeof suffixValue === "string" ? suffixValue : "";
    return (
        <div className="h-full w-full overflow-hidden" style={idTextStyle(node.props)}>
            <span>{`${prefix}${shaped}${suffix}`}</span>
        </div>
    );
}

function IdImageBody({ node, values }: { readonly node: IdNode; readonly values: Readonly<Record<string, string>> }) {
    const source = propOf(node.props, "source");
    const fitValue = propOf(node.props, "fit");
    const fit = fitValue === "contain" || fitValue === "fill" ? fitValue : "cover";
    const radius = numberProp(node.props, "radius");
    const mask = textProp(node.props, "mask") ?? "none";
    let src = "";
    if (source === "asset") {
        const direct = propOf(node.props, "src");
        if (typeof direct === "string") src = direct;
    } else {
        const field = textProp(node.props, "field") ?? "";
        if (field !== "") src = values[field] ?? "";
    }
    const maskStyle = idMaskStyle(mask, radius);
    if (src === "") {
        const field = textProp(node.props, "field") ?? "";
        const label = source === "field" && field !== "" ? field : "Image";
        const clipped = "clipPath" in maskStyle;
        return (
            <div
                className={`flex h-full w-full flex-col items-center justify-center gap-1 overflow-hidden text-muted-foreground${clipped ? " bg-muted/60" : " border-2 border-dashed border-muted-foreground/40 bg-muted/40"}`}
                style={maskStyle}
            >
                <ImageIcon aria-hidden="true" className="size-4" />
                <span className="max-w-full truncate px-1 text-[11px] font-medium">{label}</span>
            </div>
        );
    }
    const style: CSSProperties = { objectFit: fit, ...maskStyle };
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            alt=""
            className="h-full w-full ring-1 ring-inset ring-border/50"
            crossOrigin="anonymous"
            draggable={false}
            src={src}
            style={style}
        />
    );
}

function idShapeBorder(borderWidth: number | undefined, borderColor: string | undefined): CSSProperties {
    if (borderWidth === undefined || borderWidth <= 0) return {};
    return { borderWidth, borderStyle: "solid", borderColor: borderColor ?? "#000000" };
}

function idMaskStyle(mask: string, radius: number | undefined): CSSProperties {
    if (mask === "circle" || mask === "ellipse") return { borderRadius: "50%" };
    if (mask === "rounded") return { borderRadius: 24 };
    if (mask === "diamond") return { clipPath: ID_CLIP_DIAMOND };
    if (mask === "hexagon") return { clipPath: ID_CLIP_HEXAGON };
    if (mask === "star") return { clipPath: ID_CLIP_STAR };
    return { borderRadius: radius ?? 0 };
}

function IdShapeBody({ node }: { readonly node: IdNode }) {
    const kind = propOf(node.props, "shape");
    const fill = textProp(node.props, "fill");
    const borderColor = textProp(node.props, "borderColor");
    const borderWidth = numberProp(node.props, "borderWidth");
    const radius = numberProp(node.props, "radius");
    if (kind === "line") {
        return (
            <div className="flex h-full w-full items-center">
                <div className="w-full" style={{ height: 1, backgroundColor: fill ?? "#000000" }} />
            </div>
        );
    }
    if (kind === "triangle") {
        return (
            <div
                className="h-full w-full"
                style={{ backgroundColor: fill ?? "transparent", clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)" }}
            />
        );
    }
    if (kind === "diamond") {
        return (
            <div
                className="h-full w-full"
                style={{ backgroundColor: fill ?? "transparent", clipPath: ID_CLIP_DIAMOND }}
            />
        );
    }
    if (kind === "pentagon") {
        return (
            <div
                className="h-full w-full"
                style={{ backgroundColor: fill ?? "transparent", clipPath: ID_CLIP_PENTAGON }}
            />
        );
    }
    if (kind === "hexagon") {
        return (
            <div
                className="h-full w-full"
                style={{ backgroundColor: fill ?? "transparent", clipPath: ID_CLIP_HEXAGON }}
            />
        );
    }
    if (kind === "star") {
        return (
            <div
                className="h-full w-full"
                style={{ backgroundColor: fill ?? "transparent", clipPath: ID_CLIP_STAR }}
            />
        );
    }
    if (kind === "arrow") {
        return (
            <div
                className="h-full w-full"
                style={{ backgroundColor: fill ?? "transparent", clipPath: ID_CLIP_ARROW }}
            />
        );
    }
    if (kind === "ellipse") {
        return (
            <div
                className="h-full w-full"
                style={{ backgroundColor: fill, borderRadius: "50%", ...idShapeBorder(borderWidth, borderColor) }}
            />
        );
    }
    return (
        <div
            className="h-full w-full"
            style={{ backgroundColor: fill, borderRadius: radius ?? 0, ...idShapeBorder(borderWidth, borderColor) }}
        />
    );
}

export function IdNodeBody({ node, values = {} }: IdCardNodeProps) {
    if (node.type === "text") return <IdTextBody node={node} />;
    if (node.type === "variable") return <IdVariableBody node={node} />;
    if (node.type === "image") return <IdImageBody node={node} values={values} />;
    if (node.type === "shape") return <IdShapeBody node={node} />;
    return null;
}

export function IdCardNode({ node, values = {} }: IdCardNodeProps) {
    return (
        <div
            className="absolute overflow-hidden"
            style={{
                left: node.x,
                top: node.y,
                width: node.w,
                height: node.h,
                transform: `rotate(${node.rotation}deg)`,
                zIndex: node.z,
                opacity: node.opacity,
            }}
        >
            <IdNodeBody node={node} values={values} />
        </div>
    );
}
