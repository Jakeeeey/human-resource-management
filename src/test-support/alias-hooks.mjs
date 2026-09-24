import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SRC = path.resolve(import.meta.dirname, "..");
const CANDIDATES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

export async function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
        const base = path.join(SRC, specifier.slice(2));
        for (const suffix of CANDIDATES) {
            const candidate = base + suffix;
            if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                return nextResolve(pathToFileURL(candidate).href, context);
            }
        }
    }
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
        const base = path.resolve(path.dirname(new URL(context.parentURL).pathname.replace(/^\/([A-Za-z]:)/, "$1")), specifier);
        if (!path.extname(base)) {
            for (const suffix of CANDIDATES.slice(1)) {
                const candidate = decodeURIComponent(base) + suffix;
                if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                    return nextResolve(pathToFileURL(candidate).href, context);
                }
            }
        }
    }
    return nextResolve(specifier, context);
}
