import { app } from "../../scripts/app.js";

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
