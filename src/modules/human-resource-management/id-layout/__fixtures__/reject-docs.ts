import { validDoc } from "./valid-doc";

export function versionOneDoc(): unknown {
    const doc = validDoc();
    return { ...doc, version: 1 };
}

export function onePageDoc(): unknown {
    const doc = validDoc();
    return { ...doc, pages: [doc.pages[0]] };
}

export function threePageDoc(): unknown {
    const doc = validDoc();
    return {
        ...doc,
        pages: [...doc.pages, { id: "page-extra", side: "front", rootIds: [] }],
    };
}

export function doubleFrontDoc(): unknown {
    const doc = validDoc();
    return {
        ...doc,
        pages: [doc.pages[0], { ...doc.pages[1], side: "front" }],
    };
}

export function orphanNodeDoc(): unknown {
    const doc = validDoc();
    return {
        ...doc,
        nodes: {
            ...doc.nodes,
            "orphan-node": {
                id: "orphan-node",
                parentId: "stage",
                type: "shape",
                x: 10,
                y: 10,
                w: 20,
                h: 20,
                rotation: 0,
                z: 0,
                opacity: 1,
                props: {
                    shape: "rect",
                    fill: "#ff0000",
                    borderColor: "#ff0000",
                    borderWidth: 0,
                    radius: 0,
                    opacity: 1,
                },
            },
        },
    };
}

export function doubleMemberedDoc(): unknown {
    const doc = validDoc();
    return {
        ...doc,
        pages: [
            doc.pages[0],
            { ...doc.pages[1], rootIds: [...doc.pages[1].rootIds, "front-photo"] },
        ],
    };
}

export function danglingRootIdDoc(): unknown {
    const doc = validDoc();
    return {
        ...doc,
        pages: [
            doc.pages[0],
            { ...doc.pages[1], rootIds: [...doc.pages[1].rootIds, "ghost-node"] },
        ],
    };
}

export function nonStageParentDoc(): unknown {
    const doc = validDoc();
    const target = doc.nodes["front-photo"];
    return {
        ...doc,
        nodes: {
            ...doc.nodes,
            "front-photo": { ...target, parentId: "floating-layer" },
        },
    };
}

export function wrongCardDimsDoc(): unknown {
    const doc = validDoc();
    return { ...doc, card: { width: 600, height: 648 } };
}

export function unknownVariableFieldDoc(): unknown {
    const doc = validDoc();
    const target = doc.nodes["front-name"];
    if (target.type !== "variable") {
        return doc;
    }
    return {
        ...doc,
        nodes: {
            ...doc.nodes,
            "front-name": {
                ...target,
                props: { ...target.props, field: "no_such_field" },
            },
        },
    };
}

export function brokenZOrderDoc(): unknown {
    const doc = validDoc();
    const target = doc.nodes["back-strip"];
    return {
        ...doc,
        nodes: {
            ...doc.nodes,
            "back-strip": { ...target, z: 0 },
        },
    };
}
