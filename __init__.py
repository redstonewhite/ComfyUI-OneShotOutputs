WEB_DIRECTORY = "./js"


class OneShotRelay:
    """Pass-through node that relays its input unchanged.

    Use this to decouple a lightweight output (e.g. audio) from a heavy
    one-shot node so the one-shot node's large outputs (e.g. images) can be
    freed as soon as possible.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "value": ("*",),
            },
        }

    RETURN_TYPES = ("*",)
    RETURN_NAMES = ("value",)
    FUNCTION = "relay"
    CATEGORY = "utils"

    # Accept any type on the input
    @classmethod
    def VALIDATE_INPUTS(cls, **kwargs):
        return True

    def relay(self, value):
        return (value,)


NODE_CLASS_MAPPINGS = {
    "OneShotRelay": OneShotRelay,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "OneShotRelay": "One-Shot Relay",
}
