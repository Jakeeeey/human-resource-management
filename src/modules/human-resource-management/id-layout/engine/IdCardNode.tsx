import type { CSSProperties } from "react";
import type { IdNode } from "../types/id-layout.schema";
import { sanitizeIdInlineHtml } from "./sanitize";

export const ID_MISSING_VALUE = "____";

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
    if (propOf(props, "underline") === true) style.textDecorationLine = "underline";
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

function resolveIdVariable(props: unknown, values: Readonly<Record<string, string>>): string {
    const field = textProp(props, "field") ?? "";
    const raw = field === "" ? undefined : values[field];
    const base = raw === undefined || raw === "" ? ID_MISSING_VALUE : raw;
    const transform = propOf(props, "transform");
    const shaped = transform === "upper" ? base.toUpperCase() : transform === "lower" ? base.toLowerCase() : base;
    const prefixValue = propOf(props, "prefix");
    const prefix = typeof prefixValue === "string" ? prefixValue : "";
    const suffixValue = propOf(props, "suffix");
    const suffix = typeof suffixValue === "string" ? suffixValue : "";
    return `${prefix}${shaped}${suffix}`;
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

function IdVariableBody({ node, values }: { readonly node: IdNode; readonly values: Readonly<Record<string, string>> }) {
    return (
        <div className="h-full w-full overflow-hidden" style={idTextStyle(node.props)}>
            <span>{resolveIdVariable(node.props, values)}</span>
        </div>
    );
}

function IdImageBody({ node, values }: { readonly node: IdNode; readonly values: Readonly<Record<string, string>> }) {
    const source = propOf(node.props, "source");
    const fitValue = propOf(node.props, "fit");
    const fit = fitValue === "contain" || fitValue === "fill" ? fitValue : "cover";
    const radius = numberProp(node.props, "radius");
    let src = "";
    if (source === "asset") {
        const direct = propOf(node.props, "src");
        if (typeof direct === "string") src = direct;
    } else {
        const field = textProp(node.props, "field") ?? "";
        if (field !== "") src = values[field] ?? "";
    }
    if (src === "") return null;
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            alt=""
            className="h-full w-full"
            crossOrigin="anonymous"
            draggable={false}
            src={src}
            style={{ objectFit: fit, borderRadius: radius ?? 0 }}
        />
    );
}

function idShapeBorder(borderWidth: number | undefined, borderColor: string | undefined): CSSProperties {
    if (borderWidth === undefined || borderWidth <= 0) return {};
    return { borderWidth, borderStyle: "solid", borderColor: borderColor ?? "#000000" };
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
    if (node.type === "variable") return <IdVariableBody node={node} values={values} />;
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
