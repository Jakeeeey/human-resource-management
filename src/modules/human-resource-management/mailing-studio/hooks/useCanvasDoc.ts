import { temporal, type TemporalState } from "zundo";
import { create, type StoreApi } from "zustand";

import type { CanvasNode } from "../types/canvas-doc.schema";

// Canvas editor store (T7): zustand + zundo temporal.
// History contract:
//  - partialize → nodes + rootIds ONLY (selection/hover/viewport/version never enter history)
//  - limit 100 entries, JSON-equality skip for no-op/non-document sets
//  - gestures (drag/resize/rotate) coalesce: history pauses at beginGesture and
//    commits exactly ONE entry at endGesture — never per pixel.
export type CanvasHistory = Pick<CanvasDocState, "nodes" | "rootIds">;

export interface CanvasViewport {
    zoom: number;
    panX: number;
    panY: number;
}

export type CanvasNodeDraft = Omit<CanvasNode, "id"> & { id?: string };

export interface CanvasDocState {
    nodes: Record<string, CanvasNode>;
    rootIds: string[];
    selection: string[];
    hover: string | null;
    viewport: CanvasViewport;
    version: number;
    gestureActive: boolean;
    gesturePre: CanvasHistory | null;

    addNode: (draft: CanvasNodeDraft) => string | null;
    moveNode: (id: string, x: number, y: number) => void;
    moveNodesBy: (ids: string[], dx: number, dy: number) => void;
    resizeNode: (id: string, w: number, h: number) => void;
    rotateNode: (id: string, rotation: number) => void;
    updateProps: (id: string, patch: Record<string, unknown>) => void;
    removeNode: (id: string) => void;
    reorderNode: (id: string, direction: "up" | "down") => void;
    selectNodes: (ids: string[]) => void;
    setHover: (id: string | null) => void;
    setViewport: (patch: Partial<CanvasViewport>) => void;
    beginGesture: () => void;
    endGesture: () => void;
    hydrate: (doc: CanvasHistory) => void;
    undo: () => void;
    redo: () => void;
}

const HISTORY_LIMIT = 100;
const STAGE_PARENT = "stage";

type HistoryStore = StoreApi<TemporalState<CanvasHistory>>;

function partializeHistory(state: CanvasDocState): CanvasHistory {
    return { nodes: state.nodes, rootIds: state.rootIds };
}

function jsonEquality(past: CanvasHistory, current: CanvasHistory): boolean {
    return JSON.stringify(past) === JSON.stringify(current);
}

export function createCanvasDocStore() {
    return create<CanvasDocState>()(
        temporal<CanvasDocState, [], [], CanvasHistory>(
            (set, get, store) => {
                // zundo attaches the temporal store before invoking this creator;
                // through the middleware chain its type arrives as unknown.
                const history = store.temporal as HistoryStore;

                const mutate = (patch: Partial<CanvasDocState>): void =>
                    set((state) => ({ ...patch, version: state.version + 1 }));

                return {
                    nodes: {},
                    rootIds: [],
                    selection: [],
                    hover: null,
                    viewport: { zoom: 1, panX: 0, panY: 0 },
                    version: 0,
                    gestureActive: false,
                    gesturePre: null,

                    addNode: (draft) => {
                        const state = get();
                        const id = draft.id ?? crypto.randomUUID();
                        if (state.nodes[id]) return null;
                        if (draft.parentId !== STAGE_PARENT) {
                            const parent = state.nodes[draft.parentId];
                            if (
                                !parent ||
                                parent.type !== "box" ||
                                parent.parentId !== STAGE_PARENT
                            ) {
                                return null;
                            }
                        }
                        const node: CanvasNode = { ...draft, id };
                        set((current) => ({
                            nodes: { ...current.nodes, [id]: node },
                            rootIds:
                                draft.parentId === STAGE_PARENT
                                    ? [...current.rootIds, id]
                                    : current.rootIds,
                            version: current.version + 1,
                        }));
                        return id;
                    },

                    moveNode: (id, x, y) => {
                        const node = get().nodes[id];
                        if (!node) return;
                        mutate({ nodes: { ...get().nodes, [id]: { ...node, x, y } } });
                    },

                    // Group-delta drag (P0-4): shift every selected node by the
                    // same (dx, dy) in ONE mutate so the gesture stays a single
                    // history entry and a single version bump.
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

                    // Merge a props patch into one node. Same history contract as
                    // geometry mutations: bumps version, records one entry per call
                    // outside a gesture, coalesces into a single entry while a
                    // gesture is active (property fields wrap focus→blur sessions
                    // in beginGesture/endGesture so typing is one undo step).
                    updateProps: (id, patch) => {
                        const node = get().nodes[id];
                        if (!node) return;
                        mutate({
                            nodes: {
                                ...get().nodes,
                                [id]: { ...node, props: { ...node.props, ...patch } },
                            },
                        });
                    },

                    removeNode: (id) => {
                        const state = get();
                        if (!state.nodes[id]) return;
                        const doomed = new Set<string>([id]);
                        let grew = true;
                        while (grew) {
                            grew = false;
                            for (const node of Object.values(state.nodes)) {
                                if (
                                    !doomed.has(node.id) &&
                                    node.parentId !== STAGE_PARENT &&
                                    doomed.has(node.parentId)
                                ) {
                                    doomed.add(node.id);
                                    grew = true;
                                }
                            }
                        }
                        const nodes: Record<string, CanvasNode> = {};
                        for (const [key, node] of Object.entries(state.nodes)) {
                            if (!doomed.has(key)) nodes[key] = node;
                        }
                        set((current) => ({
                            nodes,
                            rootIds: state.rootIds.filter((rootId) => !doomed.has(rootId)),
                            selection: state.selection.filter((selected) => !doomed.has(selected)),
                            version: current.version + 1,
                        }));
                    },

                    selectNodes: (ids) => {
                        set({ selection: Array.from(new Set(ids)) });
                    },

                    // Layer reorder (P1-3): swap one stage-root with its neighbour
                    // and reassign every root z to its index so z === position.
                    // Single mutate → one version bump, one undo entry outside a
                    // gesture; callers wrap beginGesture/endGesture to coalesce.
                    // Box children are not roots — no-op for them.
                    reorderNode: (id, direction) => {
                        const state = get();
                        const index = state.rootIds.indexOf(id);
                        if (index < 0) return;
                        const next =
                            direction === "up" ? index - 1 : index + 1;
                        if (next < 0 || next >= state.rootIds.length) return;
                        const rootIds = [...state.rootIds];
                        const other = rootIds[next];
                        if (other === undefined) return;
                        rootIds[next] = id;
                        rootIds[index] = other;
                        const nodes = { ...state.nodes };
                        rootIds.forEach((rootId, z) => {
                            const node = nodes[rootId];
                            if (node && node.z !== z) nodes[rootId] = { ...node, z };
                        });
                        mutate({ nodes, rootIds });
                    },

                    setHover: (id) => {
                        set({ hover: id });
                    },

                    setViewport: (patch) => {
                        set((state) => ({ viewport: { ...state.viewport, ...patch } }));
                    },

                    beginGesture: () => {
                        const state = get();
                        if (state.gestureActive) return;
                        history.getState().pause();
                        set({
                            gestureActive: true,
                            gesturePre: { nodes: state.nodes, rootIds: state.rootIds },
                        });
                    },

                    endGesture: () => {
                        const state = get();
                        if (!state.gestureActive || !state.gesturePre) return;
                        const pre = state.gesturePre;
                        const post: CanvasHistory = {
                            nodes: state.nodes,
                            rootIds: state.rootIds,
                        };
                        // While paused: rewind to the pre-gesture doc (unrecorded), then
                        // resume and re-apply the post-gesture doc so zundo sees a single
                        // pre→post transition and records exactly one coalesced entry.
                        set({
                            nodes: pre.nodes,
                            rootIds: pre.rootIds,
                            gestureActive: false,
                            gesturePre: null,
                        });
                        history.getState().resume();
                        set({ nodes: post.nodes, rootIds: post.rootIds });
                    },

                    hydrate: (doc) => {
                        const state = get();
                        if (Object.keys(state.nodes).length > 0) return;
                        set({
                            nodes: { ...doc.nodes },
                            rootIds: [...doc.rootIds],
                            selection: [],
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
                partialize: partializeHistory,
                limit: HISTORY_LIMIT,
                equality: jsonEquality,
            },
        ),
    );
}

export const useCanvasDoc = createCanvasDocStore();
