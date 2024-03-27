import "jasmine"
import { exportedForTesting } from "./generate"

const { getBasicPropertyValue } = exportedForTesting;

describe("getBasicPropertyValue", () => {
    it("generates string placeholder name from variable", () => {
        expect(getBasicPropertyValue("key-name", {
            "type": "string"
        }))
        .toBe("{{ KEY_NAME }}")
    })
    
    it("generates integer placeholder from variable", () => {
        expect(getBasicPropertyValue("key-name", {
            "type": "integer"
        }))
        .toBe(-1)
    })

    it("generates const value if const is provided", () => {
        expect(getBasicPropertyValue("key-name", {
            "const": "Example value"
        }))
        .toBe("Example value")
    })
})