import { temporal, type TemporalState } from "zundo";
import { create, type StoreApi } from "zustand";
import type { IdDoc, IdNode, IdPage } from "../types/id-layout.schema";

export type IdDocHistory = Pick<IdDocState, "nodes" | "pages" | "activePageId">;

export interface IdViewport {
    zoom: number;
    panX: number;
    panY: number;
}

export type IdNodeDraft = Omit<IdNode, "id"> & { id?: string };

export interface IdDocState {
    nodes: Record<string, IdNode>;
    pages: IdPage[];
    activePageId: string | null;
    selection: string[];
    hover: string | null;
    viewport: IdViewport;
    snapEnabled: boolean;
    editingId: string | null;
    version: number;
    gestureActive: boolean;
    gesturePre: IdDocHistory | null;
    addNode: (draft: IdNodeDraft, pageId?: string) => string | null;
    moveNode: (id: string, x: number, y: number) => void;
    moveNodesBy: (ids: string[], dx: number, dy: number) => void;
    resizeNode: (id: string, w: number, h: number) => void;
    rotateNode: (id: string, rotation: number) => void;
    setOpacity: (id: string, opacity: number) => void;
    updateProps: (id: string, patch: Record<string, unknown>) => void;
    removeNode: (id: string) => void;
    reorderNode: (id: string, direction: "up" | "down") => void;
    selectNodes: (ids: string[]) => void;
    setHover: (id: string | null) => void;
    setEditingId: (id: string | null) => void;
    setViewport: (patch: Partial<IdViewport>) => void;
    setSnapEnabled: (enabled: boolean) => void;
    setActivePage: (pageId: string) => void;
    beginGesture: () => void;
    endGesture: () => void;
    hydrate: (doc: IdDocHistory) => void;
    loadDoc: (doc: IdDoc) => void;
    undo: () => void;
    redo: () => void;
}

export type IdDocStore = ReturnType<typeof createIdDocStore>;

const ID_HISTORY_LIMIT = 100;
const ID_STAGE_PARENT = "stage" as const;

export const ID_ZOOM_MIN = 0.5;
export const ID_ZOOM_MAX = 2;
export const ID_ZOOM_STEP = 0.25;

export function clampIdZoom(value: number): number {
    if (!Number.isFinite(value)) return 1;
    return Math.min(ID_ZOOM_MAX, Math.max(ID_ZOOM_MIN, value));
}

export function activePageOf(state: Pick<IdDocState, "pages" | "activePageId">): IdPage | null {
    return state.pages.find((page) => page.id === state.activePageId) ?? null;
}

export function pageOfNode(pages: readonly IdPage[], nodeId: string): IdPage | null {
    return pages.find((page) => page.rootIds.includes(nodeId)) ?? null;
}

type IdHistoryStore = StoreApi<TemporalState<IdDocHistory>>;

function partializeIdHistory(state: IdDocState): IdDocHistory {
    return { nodes: state.nodes, pages: state.pages, activePageId: state.activePageId };
}

function idHistoryEquality(past: IdDocHistory, current: IdDocHistory): boolean {
    if (past.nodes === current.nodes && past.pages === current.pages && past.activePageId === current.activePageId) return true;
    if (past.activePageId !== current.activePageId) return false;
    if (past.pages.length !== current.pages.length) return false;
    for (let index = 0; index < current.pages.length; index += 1) {
        const before = past.pages[index];
        const after = current.pages[index];
        if (before === after) continue;
        if (!before || !after || before.id !== after.id || before.side !== after.side) return false;
        if (before.rootIds.length !== after.rootIds.length) return false;
        for (let root = 0; root < after.rootIds.length; root += 1) {
            if (before.rootIds[root] !== after.rootIds[root]) return false;
        }
    }
    if (past.nodes === current.nodes) return true;
    const currentKeys = Object.keys(current.nodes);
    if (currentKeys.length !== Object.keys(past.nodes).length) return false;
    for (const key of currentKeys) {
        if (past.nodes[key] !== current.nodes[key]) return false;
    }
    return true;
}

function renumberPageZ(nodes: Record<string, IdNode>, rootIds: readonly string[]): Record<string, IdNode> {
    const next: Record<string, IdNode> = { ...nodes };
    rootIds.forEach((rootId, z) => {
        const node = next[rootId];
        if (node && node.z !== z) next[rootId] = { ...node, z };
    });
    return next;
}

export function createIdDocStore() {
    return create<IdDocState>()(
        temporal<IdDocState, [], [], IdDocHistory>(
            (set, get, store) => {
                const history = store.temporal as IdHistoryStore;

                const mutate = (patch: Partial<IdDocState>): void =>
                    set((state) => ({ ...patch, version: state.version + 1 }));

                return {
                    nodes: {},
                    pages: [],
                    activePageId: null,
                    selection: [],
                    hover: null,
                    viewport: { zoom: 1, panX: 0, panY: 0 },
                    snapEnabled: true,
                    editingId: null,
                    version: 0,
                    gestureActive: false,
                    gesturePre: null,

                    addNode: (draft, pageId) => {
                        const state = get();
                        const target = state.pages.find((page) => page.id === (pageId ?? state.activePageId)) ?? null;
                        if (!target) return null;
                        if (draft.parentId !== ID_STAGE_PARENT) return null;
                        const id = draft.id ?? crypto.randomUUID();
                        if (state.nodes[id]) return null;
                        const node = { ...draft, id, parentId: ID_STAGE_PARENT, z: target.rootIds.length } as IdNode;
                        const pages = state.pages.map((page) =>
                            page.id === target.id ? { ...page, rootIds: [...page.rootIds, id] } : page,
                        );
                        set((current) => ({
                            nodes: { ...current.nodes, [id]: node },
                            pages,
                            version: current.version + 1,
                        }));
                        return id;
                    },

                    moveNode: (id, x, y) => {
                        const node = get().nodes[id];
                        if (!node) return;
                        mutate({ nodes: { ...get().nodes, [id]: { ...node, x, y } } });
                    },

                    moveNodesBy: (ids, dx, dy) => {
                        if (dx === 0 && dy === 0) return;
                        const current = get().nodes;
                        let touched = false;
                        const nodes = { ...current };
                        for (const id of ids) {
                            const node = current[id];
                            if (!node) continue;
                            nodes[id] = { ...node, x: node.x + dx, y: node.y + dy };
                            touched = true;
                        }
                        if (!touched) return;
                        mutate({ nodes });
                    },

                    resizeNode: (id, w, h) => {
                        const node = get().nodes[id];
                        if (!node) return;
                        mutate({ nodes: { ...get().nodes, [id]: { ...node, w, h } } });
                    },

                    rotateNode: (id, rotation) => {
                        const node = get().nodes[id];
                        if (!node) return;
                        mutate({ nodes: { ...get().nodes, [id]: { ...node, rotation } } });
                    },

                    setOpacity: (id, opacity) => {
                        const node = get().nodes[id];
                        if (!node || !Number.isFinite(opacity)) return;
                        mutate({ nodes: { ...get().nodes, [id]: { ...node, opacity } } });
                    },

                    updateProps: (id, patch) => {
                        const node = get().nodes[id];
                        if (!node) return;
                        mutate({
                            nodes: {
                                ...get().nodes,
                                [id]: { ...node, props: { ...node.props, ...patch } } as IdNode,
                            },
                        });
                    },

                    removeNode: (id) => {
                        const state = get();
                        if (!state.nodes[id]) return;
                        const nodes: Record<string, IdNode> = {};
                        for (const [key, node] of Object.entries(state.nodes)) {
                            if (key !== id) nodes[key] = node;
                        }
                        const pages = state.pages.map((page) =>
                            page.rootIds.includes(id)
                                ? { ...page, rootIds: page.rootIds.filter((rootId) => rootId !== id) }
                                : page,
                        );
                        let renumbered = nodes;
                        for (const page of pages) {
                            renumbered = renumberPageZ(renumbered, page.rootIds);
                        }
                        set((current) => ({
                            nodes: renumbered,
                            pages,
                            selection: state.selection.filter((selected) => selected !== id),
                            version: current.version + 1,
                        }));
                    },

                    reorderNode: (id, direction) => {
                        const state = get();
                        const page = pageOfNode(state.pages, id);
                        if (!page) return;
                        const index = page.rootIds.indexOf(id);
                        const next = direction === "up" ? index - 1 : index + 1;
                        if (index < 0 || next < 0 || next >= page.rootIds.length) return;
                        const rootIds = [...page.rootIds];
                        const other = rootIds[next];
                        if (other === undefined) return;
                        rootIds[next] = id;
                        rootIds[index] = other;
                        const pages = state.pages.map((candidate) =>
                            candidate.id === page.id ? { ...page, rootIds } : candidate,
                        );
                        mutate({ nodes: renumberPageZ(state.nodes, rootIds), pages });
                    },

                    selectNodes: (ids) => {
                        set({ selection: Array.from(new Set(ids)) });
                    },

                    setHover: (id) => {
                        set({ hover: id });
                    },

                    setEditingId: (id) => {
                        set({ editingId: id });
                    },

                    setViewport: (patch) => {
                        set((state) => ({ viewport: { ...state.viewport, ...patch } }));
                    },

                    setSnapEnabled: (enabled) => {
                        set({ snapEnabled: enabled });
                    },

                    setActivePage: (pageId) => {
                        const state = get();
                        if (!state.pages.some((page) => page.id === pageId)) return;
                        if (state.activePageId === pageId) return;
                        set({ activePageId: pageId, selection: [], editingId: null });
                    },

                    beginGesture: () => {
                        const state = get();
                        if (state.gestureActive) return;
                        history.getState().pause();
                        set({
                            gestureActive: true,
                            gesturePre: {
                                nodes: state.nodes,
                                pages: state.pages,
                                activePageId: state.activePageId,
                            },
                        });
                    },

                    endGesture: () => {
                        const state = get();
                        if (!state.gestureActive || !state.gesturePre) return;
                        const pre = state.gesturePre;
                        const post: IdDocHistory = {
                            nodes: state.nodes,
                            pages: state.pages,
                            activePageId: state.activePageId,
                        };
                        set({
                            nodes: pre.nodes,
                            pages: pre.pages,
                            activePageId: pre.activePageId,
                            gestureActive: false,
                            gesturePre: null,
                        });
                        history.getState().resume();
                        set({ nodes: post.nodes, pages: post.pages, activePageId: post.activePageId });
                    },

                    hydrate: (doc) => {
                        const state = get();
                        if (Object.keys(state.nodes).length > 0) return;
                        set({
                            nodes: { ...doc.nodes },
                            pages: doc.pages.map((page) => ({ ...page, rootIds: [...page.rootIds] })),
                            activePageId: doc.activePageId,
                            selection: [],
                        });
                        history.getState().clear();
                    },

                    loadDoc: (doc) => {
                        set({
                            nodes: { ...doc.nodes },
                            pages: doc.pages.map((page) => ({ ...page, rootIds: [...page.rootIds] })),
                            activePageId: doc.pages[0]?.id ?? null,
                            selection: [],
                            editingId: null,
                            gestureActive: false,
                            gesturePre: null,
                        });
                        history.getState().clear();
                    },

                    undo: () => {
                        const temporalState = history.getState();
                        if (temporalState.pastStates.length === 0) return;
                        temporalState.undo();
                        set((state) => ({ version: state.version + 1 }));
                    },

                    redo: () => {
                        const temporalState = history.getState();
                        if (temporalState.futureStates.length === 0) return;
                        temporalState.redo();
                        set((state) => ({ version: state.version + 1 }));
                    },
                };
            },
            {
                partialize: partializeIdHistory,
                limit: ID_HISTORY_LIMIT,
                equality: idHistoryEquality,
            },
        ),
    );
}
