/// <reference types="vitest" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import checker from "vite-plugin-checker";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import * as path from "path";
import * as esbuild from "esbuild";

const REDIRECT_PATHS = ["/dhis-web-pivot", "/dhis-web-data-visualizer"];

/** Transform .js files that contain JSX (e.g. src/legacy) so esbuild parses them as JSX. */
function jsxInJsPlugin() {
    return {
        name: "jsx-in-js",
        transform(code: string, id: string) {
            if (!id.endsWith(".js") || id.includes("node_modules")) return null;
            if (!path.resolve(id).startsWith(path.resolve(process.cwd(), "src"))) return null;
            try {
                const result = esbuild.transformSync(code, {
                    loader: "jsx",
                    sourcefile: id,
                    sourcemap: true,
                });
                return { code: result.code, map: result.map || undefined };
            } catch {
                return null;
            }
        },
    };
}

const config = defineConfig(({ mode }) => {
    const env = { ...process.env, ...loadEnv(mode, process.cwd()) };
    const proxyConfig = getProxy(env);

    return {
        base: "",
        resolve: {
            alias: {
                $: path.resolve(__dirname, "./src"),
                // buffer, stream, events, global, process los aporta nodePolyfills (como central-planning-reporting)
            },
            // Una sola instancia de i18n para que addResources exista (evita "Hz.addResources is not a function" en DHIS2)
            dedupe: ["@dhis2/d2-i18n", "i18next"],
        },
        optimizeDeps: {
            esbuildOptions: {
                loader: {
                    ".js": "jsx",
                },
            },
        },
        define: {
            "process.env.NODE_DEBUG": "undefined",
            __dirname: JSON.stringify(""),
            __filename: JSON.stringify(""),
        },
        esbuild: {
            define: {
                // global solo en esbuild para no romper imports tipo './global-state-service' en Rollup
                global: "globalThis",
            },
        },
        plugins: [
            nodePolyfills({
                globals: { Buffer: true, global: true, process: true },
                protocolImports: true,
            }),
            redirectMiddleware(env),
            jsxInJsPlugin(),
            react(),
            checker({
                overlay: false,
                typescript: true,
                eslint: {
                    lintCommand: 'eslint "./src/**/*.{ts,tsx}"',
                    dev: { logLevel: ["warning"] },
                },
            }),
        ],
        test: {
            environment: "jsdom",
            include: ["**/*.spec.{ts,tsx}"],
            setupFiles: ["./config/testSetup.ts", "./src/tests/setup.js"],
            exclude: ["node_modules", "cypress", ".est_ai/**"],
            globals: true,
        },
        server: {
            port: parseInt(env.VITE_PORT || "8081", 10),
            proxy: proxyConfig,
        },
    };
});

export default config;

function getProxy(env: Record<string, string>) {
    const dhis2UrlVar = "VITE_DHIS2_BASE_URL";
    const dhis2AuthVar = "VITE_DHIS2_AUTH";
    const targetUrl = env[dhis2UrlVar];
    const auth = env[dhis2AuthVar];
    const isBuild = env.NODE_ENV === "production";

    if (isBuild) {
        return {};
    }
    if (!targetUrl) {
        console.error(`Set ${dhis2UrlVar}`);
        process.exit(1);
    }
    if (!auth) {
        console.error(`Set ${dhis2AuthVar}`);
        process.exit(1);
    }
    return {
        "/dhis2": {
            target: targetUrl,
            changeOrigin: true,
            auth: auth,
            rewrite: (path: string) => path.replace(/^\/dhis2/, ""),
        },
    };
}

/** Redirect /dhis2/dhis-web-pivot and /dhis2/dhis-web-data-visualizer to DHIS2 (apps don't work through proxy). */
function redirectMiddleware(env: Record<string, string>) {
    const targetUrl = env.VITE_DHIS2_BASE_URL || "";
    return {
        name: "dhis2-redirect",
        configureServer(server: {
            middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void };
        }) {
            server.middlewares.use(
                (
                    req: { url?: string },
                    res: { writeHead: (a: number, b: object) => void; end: () => void },
                    next: () => void
                ) => {
                    const url = req.url || "";
                    if (!url.startsWith("/dhis2")) {
                        next();
                        return;
                    }
                    const pathWithoutPrefix = url.replace(/^\/dhis2/, "") || "/";
                    const shouldRedirect = REDIRECT_PATHS.some(p => pathWithoutPrefix.startsWith(p));
                    if (shouldRedirect && targetUrl) {
                        const redirectUrl = targetUrl.replace(/\/$/, "") + pathWithoutPrefix;
                        res.writeHead(302, { Location: redirectUrl });
                        res.end();
                    } else {
                        next();
                    }
                }
            );
        },
    };
}
