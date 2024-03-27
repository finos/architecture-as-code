import { exportedForTesting } from "./generate"

const { getPropertyValue } = exportedForTesting;

describe("getPropertyValue", () => {
    it("generates string placeholder name from variable", () => {
        expect(getPropertyValue("key-name", {
            "type": "string"
        }))
            .toBe("{{ KEY_NAME }}")
    })

    it("generates integer placeholder from variable", () => {
        expect(getPropertyValue("key-name", {
            "type": "integer"
        }))
            .toBe(-1)
    })

    it("generates const value if const is provided", () => {
        expect(getPropertyValue("key-name", {
            "const": "Example value"
        }))
            .toBe("Example value")
    })

    it("generates const value with entire subtree if const is provided", () => {
        expect(getPropertyValue("key-name", {
            "const": {
                "connects": {
                    "source": "source",
                    "destination": "destination"
                }
            }
        }))
            .toEqual({
                "connects": {
                    "source": "source",
                    "destination": "destination"
                }
            })
    })
})