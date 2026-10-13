import type { Ref } from "react";
import { ID_CARD } from "../types/id-layout.schema";
import type { IdNode, IdPage } from "../types/id-layout.schema";
import { IdCardNode } from "./IdCardNode";

export interface IdCardSideProps {
    readonly page: IdPage;
    readonly nodes: Readonly<Record<string, IdNode>>;
    readonly values?: Readonly<Record<string, string>>;
    readonly innerRef?: Ref<HTMLDivElement>;
    readonly zoom?: number;
}

export function IdCardSide({ page, nodes, values = {}, innerRef, zoom = 1 }: IdCardSideProps) {
    return (
        <div
            className="relative overflow-hidden border border-transparent bg-white text-black"
            data-id-card-side={page.side}
            ref={innerRef}
            style={{ width: ID_CARD.width, height: ID_CARD.height, zoom }}
        >
            {page.rootIds.map((id) => {
                const node = nodes[id];
                if (!node) return null;
                return <IdCardNode key={id} node={node} values={values} />;
            })}
        </div>
    );
}
