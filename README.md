# ComfyUI One-Shot Outputs

A minimal ComfyUI extension that lets you mark any node to **discard its output from cache immediately after all downstream nodes have consumed it**. This is useful for nodes that produce massive intermediate data (large latents, high-res images, video frames, etc.) Once processed by the next node, the intermediate data is freed from memory instead of being held in ComfyUI's global output cache.

It is different from `--cache-none`, as nodes not marked will preserve their output in cache. This is useful when you have a massive workflow with multiple intermediate steps.

## Why?

By default, ComfyUI caches every node's output during one prompt. If you use `--cache-ram` or `--cache-lru`, ComfyUI only clean-up cache after it finishes current prompt. But in large workflows, some intermediate outputs are enormous and only needed once. Holding them in cache wastes RAM/VRAM for no benefit, especially for unified memory devices like DGX Spark.

With this extension, you right-click a node → toggle **"Discard Output After Use"** → and that node's output is freed **immediately** after all its downstream consumers have finished executing.

**Trade-off**: Nodes with this toggle enabled will always re-execute on subsequent runs (since their output is never cached). This is the intended behavior. 

## How It Works

- **Frontend**: Adds a right-click context menu toggle to every node that has outputs. The state is stored in `node.properties.discard_output` and persists with the workflow.
- **Backend**: After a node executes, if `discard_output` is set, the output is passed to downstream nodes via the execution-scoped cache but **not** stored in the persistent global cache. Once all downstream consumers complete, the output has zero references and is garbage collected.
- **Multiple outputs**: If a discard-output node feeds into 3 different downstream nodes, all 3 get the data. The output is only freed after the last consumer finishes.

## Installation

This extension requires a small patch to ComfyUI's core execution engine (2 files, ~5 lines changed).

### Step 1: Clone the extension

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/redstonewhite/ComfyUI-OneShotOutputs.git
```

### Step 2: Apply the core patches

Two files in ComfyUI need minor modifications:

#### `comfy_execution/graph.py`

In the `ExecutionList.__init__` method, add `self.discard_output_nodes = set()`:

```python
# In class ExecutionList(TopologicalSort):
def __init__(self, dynprompt, output_cache):
    super().__init__(dynprompt)
    self.output_cache = output_cache
    self.staged_node_id = None
    self.execution_cache = {}
    self.execution_cache_listeners = {}
    self.discard_output_nodes = set()       # <-- ADD THIS LINE
```

In `ExecutionList.get_cache`, guard the write-back:

```python
def get_cache(self, from_node_id, to_node_id):
    if to_node_id not in self.execution_cache:
        return None
    value = self.execution_cache[to_node_id].get(from_node_id)
    if value is None:
        return None
    # Write back to the main cache on touch.
    if from_node_id not in self.discard_output_nodes:    # <-- ADD THIS LINE
        self.output_cache.set_local(from_node_id, value)
    return value
```

#### `execution.py`

In the `execute()` function, replace the unconditional cache store with a conditional one:

```python
# Find this block (around line 590):
#
#   cache_entry = CacheEntry(ui=ui_outputs.get(unique_id), outputs=output_data)
#   execution_list.cache_update(unique_id, cache_entry)
#   await caches.outputs.set(unique_id, cache_entry)
#
# Replace with:

cache_entry = CacheEntry(ui=ui_outputs.get(unique_id), outputs=output_data)
execution_list.cache_update(unique_id, cache_entry)
# Per-node prompt flag takes precedence, then class attribute
discard = dynprompt.get_node(unique_id).get('discard_output', getattr(class_def, 'DISCARD_OUTPUT', False))
if discard:
    execution_list.discard_output_nodes.add(unique_id)
else:
    await caches.outputs.set(unique_id, cache_entry)
```

### Step 3: Restart ComfyUI

Restart ComfyUI and the extension will be loaded automatically.

## Usage

1. Right-click any node that has outputs
2. Click **"❌ Discard Output After Use"** to enable (toggles to ✅)
3. Click again to disable (toggles back to ❌)
4. The setting is saved with the workflow

Nodes with the toggle enabled will show ✅ in the menu and will:
- Pass their output to all connected downstream nodes normally
- **Not** store the output in ComfyUI's persistent cache
- Re-execute on every prompt run (since output is never cached)
- Free the output data after all downstream nodes finish

## For Custom Node Authors

You can also set `DISCARD_OUTPUT = True` as a class attribute on your node to make it the default behavior (users can still override per-node via the right-click menu):

```python
class MyHeavyIntermediateNode:
    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "process"
    CATEGORY = "image"
    DISCARD_OUTPUT = True  # Output freed after downstream nodes consume it

    def process(self, ...):
        ...
```

## License

MIT
