import type { Ref } from "react";
import type { IdNode, IdPage } from "../types/id-layout.schema";
import { IdViewerNode } from "./IdViewerNode";

export const ID_VIEWER_CARD = {
    width: 408,
    height: 648,
} as const;

export interface IdViewerSideProps {
    readonly page: IdPage;
    readonly nodes: Readonly<Record<string, IdNode>>;
    readonly values?: Readonly<Record<string, string>>;
    readonly innerRef?: Ref<HTMLDivElement>;
}

export function IdViewerSide({ page, nodes, values = {}, innerRef }: IdViewerSideProps) {
    return (
        <div
            className="relative overflow-hidden bg-white"
            data-id-viewer-side={page.side}
            ref={innerRef}
            style={{ width: ID_VIEWER_CARD.width, height: ID_VIEWER_CARD.height }}
        >
            {page.rootIds.map((id) => {
                const node = nodes[id];
                if (!node) return null;
                return <IdViewerNode key={id} node={node} values={values} />;
            })}
        </div>
    );
}
