import type { CSSProperties, Ref } from "react";
import type { EmployeeIdNode, EmployeeIdPage } from "./employeeIdTemplate";
import { sanitizeEmployeeIdInlineHtml } from "./employeeIdSanitize";

export const EMPLOYEE_ID_MISSING_VALUE = "____";

const EMPLOYEE_ID_CLIP_DIAMOND = "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
const EMPLOYEE_ID_CLIP_PENTAGON = "polygon(50% 0%, 100% 38%, 81% 100%, 19% 100%, 0% 38%)";
const EMPLOYEE_ID_CLIP_HEXAGON = "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
const EMPLOYEE_ID_CLIP_STAR = "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";
const EMPLOYEE_ID_CLIP_ARROW = "polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)";

export interface EmployeeIdNodeValues {
    readonly node: EmployeeIdNode;
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

function employeeIdTextStyle(props: unknown): CSSProperties {
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

export function employeeIdNodeText(node: EmployeeIdNode): string {
    const raw = propOf(node.props, "text");
    return typeof raw === "string" ? raw : "";
}

function resolveEmployeeIdVariable(props: unknown, values: Readonly<Record<string, string>>): string {
    const field = textProp(props, "field") ?? "";
    const raw = field === "" ? undefined : values[field];
    const base = raw === undefined || raw === "" ? EMPLOYEE_ID_MISSING_VALUE : raw;
    const transform = propOf(props, "transform");
    const shaped = transform === "upper" ? base.toUpperCase() : transform === "lower" ? base.toLowerCase() : base;
    const prefixValue = propOf(props, "prefix");
    const prefix = typeof prefixValue === "string" ? prefixValue : "";
    const suffixValue = propOf(props, "suffix");
    const suffix = typeof suffixValue === "string" ? suffixValue : "";
    return `${prefix}${shaped}${suffix}`;
}

function EmployeeIdTextBody({ node }: { readonly node: EmployeeIdNode }) {
    return (
        <div
            className="h-full w-full overflow-hidden"
            dangerouslySetInnerHTML={{ __html: sanitizeEmployeeIdInlineHtml(employeeIdNodeText(node)) }}
            style={employeeIdTextStyle(node.props)}
        />
    );
}

function EmployeeIdVariableBody({ node, values }: { readonly node: EmployeeIdNode; readonly values: Readonly<Record<string, string>> }) {
    return (
        <div className="h-full w-full overflow-hidden" style={employeeIdTextStyle(node.props)}>
            <span>{resolveEmployeeIdVariable(node.props, values)}</span>
        </div>
    );
}

function EmployeeIdImageBody({ node, values }: { readonly node: EmployeeIdNode; readonly values: Readonly<Record<string, string>> }) {
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
    if (src === "") return null;
    const style: CSSProperties = { objectFit: fit };
    if (mask === "circle" || mask === "ellipse") {
        style.borderRadius = "50%";
    } else if (mask === "rounded") {
        style.borderRadius = 24;
    } else if (mask === "diamond") {
        style.clipPath = EMPLOYEE_ID_CLIP_DIAMOND;
    } else if (mask === "hexagon") {
        style.clipPath = EMPLOYEE_ID_CLIP_HEXAGON;
    } else if (mask === "star") {
        style.clipPath = EMPLOYEE_ID_CLIP_STAR;
    } else {
        style.borderRadius = radius ?? 0;
    }
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            alt=""
            className="h-full w-full"
            crossOrigin="anonymous"
            draggable={false}
            src={src}
            style={style}
        />
    );
}

function employeeIdShapeBorder(borderWidth: number | undefined, borderColor: string | undefined): CSSProperties {
    if (borderWidth === undefined || borderWidth <= 0) return {};
    return { borderWidth, borderStyle: "solid", borderColor: borderColor ?? "#000000" };
}

function EmployeeIdShapeBody({ node }: { readonly node: EmployeeIdNode }) {
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
                style={{ backgroundColor: fill ?? "transparent", clipPath: EMPLOYEE_ID_CLIP_DIAMOND }}
            />
        );
    }
    if (kind === "pentagon") {
        return (
            <div
                className="h-full w-full"
                style={{ backgroundColor: fill ?? "transparent", clipPath: EMPLOYEE_ID_CLIP_PENTAGON }}
            />
        );
    }
    if (kind === "hexagon") {
        return (
            <div
                className="h-full w-full"
                style={{ backgroundColor: fill ?? "transparent", clipPath: EMPLOYEE_ID_CLIP_HEXAGON }}
            />
        );
    }
    if (kind === "star") {
        return (
            <div
                className="h-full w-full"
                style={{ backgroundColor: fill ?? "transparent", clipPath: EMPLOYEE_ID_CLIP_STAR }}
            />
        );
    }
    if (kind === "arrow") {
        return (
            <div
                className="h-full w-full"
                style={{ backgroundColor: fill ?? "transparent", clipPath: EMPLOYEE_ID_CLIP_ARROW }}
            />
        );
    }
    if (kind === "ellipse") {
        return (
            <div
                className="h-full w-full"
                style={{ backgroundColor: fill, borderRadius: "50%", ...employeeIdShapeBorder(borderWidth, borderColor) }}
            />
        );
    }
    return (
        <div
            className="h-full w-full"
            style={{ backgroundColor: fill, borderRadius: radius ?? 0, ...employeeIdShapeBorder(borderWidth, borderColor) }}
        />
    );
}

export function EmployeeIdNodeBody({ node, values = {} }: EmployeeIdNodeValues) {
    if (node.type === "text") return <EmployeeIdTextBody node={node} />;
    if (node.type === "variable") return <EmployeeIdVariableBody node={node} values={values} />;
    if (node.type === "image") return <EmployeeIdImageBody node={node} values={values} />;
    if (node.type === "shape") return <EmployeeIdShapeBody node={node} />;
    return null;
}

export function EmployeeIdCardNode({ node, values = {} }: EmployeeIdNodeValues) {
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
            <EmployeeIdNodeBody node={node} values={values} />
        </div>
    );
}

export interface EmployeeIdCardSideProps {
    readonly page: EmployeeIdPage;
    readonly nodes: Readonly<Record<string, EmployeeIdNode>>;
    readonly values?: Readonly<Record<string, string>>;
    readonly innerRef?: Ref<HTMLDivElement>;
    readonly zoom?: number;
}

export function EmployeeIdCardSide({ page, nodes, values = {}, innerRef, zoom = 1 }: EmployeeIdCardSideProps) {
    return (
        <div
            className="relative overflow-hidden border border-transparent bg-card"
            data-id-card-side={page.side}
            ref={innerRef}
            style={{ width: 408, height: 648, zoom }}
        >
            {page.rootIds.map((id) => {
                const node = nodes[id];
                if (!node) return null;
                return <EmployeeIdCardNode key={id} node={node} values={values} />;
            })}
        </div>
    );
}
