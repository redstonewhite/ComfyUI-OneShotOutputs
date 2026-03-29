import { app } from "../../scripts/app.js";

const BADGE_COLOR = "#e74c3c";
const BADGE_TEXT = "⚡ONE-SHOT";
const BADGE_FONT = "bold 10px sans-serif";
const BADGE_PAD_X = 6;
const BADGE_PAD_Y = 3;
const BADGE_MARGIN = 6;

app.registerExtension({
    name: "Comfy.DiscardOutput",
    async nodeCreated(node) {
        // Only add to nodes that have outputs
        if (!node.outputs || node.outputs.length === 0) return;

        // Initialize property
        if (node.properties === undefined) node.properties = {};
        if (node.properties.discard_output === undefined) {
            node.properties.discard_output = false;
        }

        // Draw a badge on the node title bar when discard is enabled
        const origDrawForeground = node.onDrawForeground;
        node.onDrawForeground = function (ctx) {
            origDrawForeground?.apply(this, arguments);
            if (!this.properties.discard_output) return;

            ctx.save();
            ctx.font = BADGE_FONT;
            const textWidth = ctx.measureText(BADGE_TEXT).width;
            const badgeW = textWidth + BADGE_PAD_X * 2;
            const badgeH = 16;
            const x = this.size[0] - badgeW - BADGE_MARGIN;
            const y = -LiteGraph.NODE_TITLE_HEIGHT + (LiteGraph.NODE_TITLE_HEIGHT - badgeH) / 2;

            // Background pill
            ctx.fillStyle = BADGE_COLOR;
            ctx.beginPath();
            ctx.roundRect(x, y, badgeW, badgeH, 4);
            ctx.fill();

            // Text
            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(BADGE_TEXT, x + badgeW / 2, y + badgeH / 2);
            ctx.restore();
        };

        const origGetExtraMenuOptions = node.getExtraMenuOptions;
        node.getExtraMenuOptions = function (_, options) {
            origGetExtraMenuOptions?.apply(this, arguments);
            options.unshift({
                content: this.properties.discard_output
                    ? "✅ Discard Output After Use"
                    : "❌ Discard Output After Use",
                callback: () => {
                    this.properties.discard_output = !this.properties.discard_output;
                    // Mark graph as changed so it gets saved
                    app.graph.setDirtyCanvas(true, true);
                },
            });
        };
    },
    async setup() {
        // Hook graphToPrompt to inject discard_output into the API prompt
        const originalGraphToPrompt = app.graphToPrompt;
        app.graphToPrompt = async function () {
            const result = await originalGraphToPrompt.apply(this, arguments);
            if (result && result.output) {
                // Walk all graph nodes and inject discard_output into the prompt
                for (const node of app.graph._nodes) {
                    if (
                        node.properties?.discard_output &&
                        result.output[String(node.id)]
                    ) {
                        result.output[String(node.id)].discard_output = true;
                    }
                }
            }
            return result;
        };
    },
});
