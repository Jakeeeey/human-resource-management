import type { CSSProperties } from "react";
import Image from "next/image";
import type { IdNode } from "../types/id-layout.schema";
import { sanitizeIdViewerInlineHtml } from "./idViewerSanitize";

export const ID_VIEWER_MISSING_VALUE = "____";

const ID_VIEWER_CLIP_DIAMOND = "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
const ID_VIEWER_CLIP_PENTAGON = "polygon(50% 0%, 100% 38%, 81% 100%, 19% 100%, 0% 38%)";
const ID_VIEWER_CLIP_HEXAGON = "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
const ID_VIEWER_CLIP_STAR = "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";
const ID_VIEWER_CLIP_ARROW = "polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)";

export interface IdViewerNodeProps {
    readonly node: IdNode;
    readonly values?: Readonly<Record<string, string>>;
}

function viewerPropOf(props: unknown, key: string): unknown {
    if (typeof props !== "object" || props === null) return undefined;
    return (props as Readonly<Record<string, unknown>>)[key];
}

function viewerTextProp(props: unknown, key: string): string | undefined {
    const value = viewerPropOf(props, key);
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function viewerNumberProp(props: unknown, key: string): number | undefined {
    const value = viewerPropOf(props, key);
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function viewerAlignProp(props: unknown): "left" | "center" | "right" | undefined {
    const value = viewerPropOf(props, "align");
    return value === "left" || value === "center" || value === "right" ? value : undefined;
}

function idViewerTextStyle(props: unknown): CSSProperties {
    const style: CSSProperties = {};
    const fontFamily = viewerTextProp(props, "fontFamily");
    if (fontFamily !== undefined) style.fontFamily = fontFamily;
    const fontSize = viewerNumberProp(props, "fontSize");
    if (fontSize !== undefined && fontSize > 0) style.fontSize = fontSize;
    const fontWeight = viewerPropOf(props, "fontWeight");
    if (typeof fontWeight === "number" && Number.isFinite(fontWeight) && fontWeight > 0) {
        style.fontWeight = fontWeight;
    } else if (fontWeight === "normal" || fontWeight === "bold") {
        style.fontWeight = fontWeight;
    }
    if (viewerPropOf(props, "italic") === true) style.fontStyle = "italic";
    const underline = viewerPropOf(props, "underline") === true;
    const strikethrough = viewerPropOf(props, "strikethrough") === true;
    if (underline && strikethrough) style.textDecorationLine = "underline line-through";
    else if (underline) style.textDecorationLine = "underline";
    else if (strikethrough) style.textDecorationLine = "line-through";
    const color = viewerTextProp(props, "color");
    if (color !== undefined) style.color = color;
    const align = viewerAlignProp(props);
    if (align !== undefined) style.textAlign = align;
    const letterSpacing = viewerNumberProp(props, "letterSpacing");
    if (letterSpacing !== undefined) style.letterSpacing = letterSpacing;
    const lineHeight = viewerPropOf(props, "lineHeight");
    if (typeof lineHeight === "number" && Number.isFinite(lineHeight) && lineHeight > 0) {
        style.lineHeight = lineHeight;
    } else if (typeof lineHeight === "string" && lineHeight.trim().length > 0) {
        style.lineHeight = lineHeight.trim();
    }
    const strokeWidth = viewerNumberProp(props, "strokeWidth");
    const strokeColor = viewerTextProp(props, "strokeColor");
    if (strokeWidth !== undefined && strokeWidth > 0 && strokeColor !== undefined) {
        style.WebkitTextStroke = `${strokeWidth}px ${strokeColor}`;
    }
    return style;
}

export function idViewerNodeText(node: IdNode): string {
    const raw = viewerPropOf(node.props, "text");
    return typeof raw === "string" ? raw : "";
}

function resolveIdViewerVariable(props: unknown, values: Readonly<Record<string, string>>): string {
    const field = viewerTextProp(props, "field") ?? "";
    const raw = field === "" ? undefined : values[field];
    const base = raw === undefined || raw === "" ? ID_VIEWER_MISSING_VALUE : raw;
    const transform = viewerPropOf(props, "transform");
    const shaped = transform === "upper" ? base.toUpperCase() : transform === "lower" ? base.toLowerCase() : base;
    const prefixValue = viewerPropOf(props, "prefix");
    const prefix = typeof prefixValue === "string" ? prefixValue : "";
    const suffixValue = viewerPropOf(props, "suffix");
    const suffix = typeof suffixValue === "string" ? suffixValue : "";
    return `${prefix}${shaped}${suffix}`;
}

function IdViewerTextBody({ node }: { readonly node: IdNode }) {
    return (
        <div
            className="h-full w-full overflow-hidden"
            dangerouslySetInnerHTML={{ __html: sanitizeIdViewerInlineHtml(idViewerNodeText(node)) }}
            style={idViewerTextStyle(node.props)}
        />
    );
}

function IdViewerVariableBody({ node, values }: { readonly node: IdNode; readonly values: Readonly<Record<string, string>> }) {
    return (
        <div className="h-full w-full overflow-hidden" style={idViewerTextStyle(node.props)}>
            <span>{resolveIdViewerVariable(node.props, values)}</span>
        </div>
    );
}

function IdViewerImageBody({ node, values }: { readonly node: IdNode; readonly values: Readonly<Record<string, string>> }) {
    const source = viewerPropOf(node.props, "source");
    const fitValue = viewerPropOf(node.props, "fit");
    const fit = fitValue === "contain" || fitValue === "fill" ? fitValue : "cover";
    const radius = viewerNumberProp(node.props, "radius");
    const mask = viewerTextProp(node.props, "mask") ?? "none";
    let src = "";
    if (source === "asset") {
        const direct = viewerPropOf(node.props, "src");
        if (typeof direct === "string") src = direct;
    } else {
        const field = viewerTextProp(node.props, "field") ?? "";
        if (field !== "") src = values[field] ?? "";
    }
    if (src === "") return null;
    const style: CSSProperties = { objectFit: fit };
    if (mask === "circle" || mask === "ellipse") {
        style.borderRadius = "50%";
    } else if (mask === "rounded") {
        style.borderRadius = 24;
    } else if (mask === "diamond") {
        style.clipPath = ID_VIEWER_CLIP_DIAMOND;
    } else if (mask === "hexagon") {
        style.clipPath = ID_VIEWER_CLIP_HEXAGON;
    } else if (mask === "star") {
        style.clipPath = ID_VIEWER_CLIP_STAR;
    } else {
        style.borderRadius = radius ?? 0;
    }
    return (
        <Image
            alt=""
            className="h-full w-full"
            crossOrigin="anonymous"
            height={node.h}
            src={src}
            style={style}
            unoptimized
            width={node.w}
        />
    );
}

function idViewerShapeBorder(borderWidth: number | undefined, borderColor: string | undefined): CSSProperties {
    if (borderWidth === undefined || borderWidth <= 0) return {};
    return { borderWidth, borderStyle: "solid", borderColor: borderColor ?? "#000000" };
}

function IdViewerShapeBody({ node }: { readonly node: IdNode }) {
    const kind = viewerPropOf(node.props, "shape");
    const fill = viewerTextProp(node.props, "fill");
    const borderColor = viewerTextProp(node.props, "borderColor");
    const borderWidth = viewerNumberProp(node.props, "borderWidth");
    const radius = viewerNumberProp(node.props, "radius");
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
                style={{ backgroundColor: fill ?? "transparent", clipPath: ID_VIEWER_CLIP_DIAMOND }}
            />
        );
    }
    if (kind === "pentagon") {
        return (
            <div
                className="h-full w-full"
                style={{ backgroundColor: fill ?? "transparent", clipPath: ID_VIEWER_CLIP_PENTAGON }}
            />
        );
    }
    if (kind === "hexagon") {
        return (
            <div
                className="h-full w-full"
                style={{ backgroundColor: fill ?? "transparent", clipPath: ID_VIEWER_CLIP_HEXAGON }}
            />
        );
    }
    if (kind === "star") {
        return (
            <div
                className="h-full w-full"
                style={{ backgroundColor: fill ?? "transparent", clipPath: ID_VIEWER_CLIP_STAR }}
            />
        );
    }
    if (kind === "arrow") {
        return (
            <div
                className="h-full w-full"
                style={{ backgroundColor: fill ?? "transparent", clipPath: ID_VIEWER_CLIP_ARROW }}
            />
        );
    }
    if (kind === "ellipse") {
        return (
            <div
                className="h-full w-full"
                style={{ backgroundColor: fill, borderRadius: "50%", ...idViewerShapeBorder(borderWidth, borderColor) }}
            />
        );
    }
    return (
        <div
            className="h-full w-full"
            style={{ backgroundColor: fill, borderRadius: radius ?? 0, ...idViewerShapeBorder(borderWidth, borderColor) }}
        />
    );
}

export function IdViewerNodeBody({ node, values = {} }: IdViewerNodeProps) {
    if (node.type === "text") return <IdViewerTextBody node={node} />;
    if (node.type === "variable") return <IdViewerVariableBody node={node} values={values} />;
    if (node.type === "image") return <IdViewerImageBody node={node} values={values} />;
    if (node.type === "shape") return <IdViewerShapeBody node={node} />;
    return null;
}

export function IdViewerNode({ node, values = {} }: IdViewerNodeProps) {
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
            <IdViewerNodeBody node={node} values={values} />
        </div>
    );
}
