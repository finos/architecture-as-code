import { exportedForTesting } from "./generate"
import { runGenerate } from "./generate";
import { tmpdir } from "node:os"
import { existsSync, mkdtempSync, readFileSync, rmSync, rmdir, rmdirSync } from "node:fs";
import path from "node:path";

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

describe("runGenerate", () => {
    let tempDirectoryPath;
    const testPath: string = "test_fixtures/api-gateway.json"

    beforeEach(() => {
        tempDirectoryPath = mkdtempSync(path.join(tmpdir(), "calm-test-"))
    })

    afterEach(() => {
        rmSync(tempDirectoryPath, { recursive: true, force: true })
    })

    it("instantiates to given directory", () => {
        const outPath = path.join(tempDirectoryPath, "output.json")
        runGenerate(testPath, outPath, false)

        expect(existsSync(outPath))
            .toBeTruthy()
    })

    it("instantiates to given directory with nested folders", () => {
        const outPath = path.join(tempDirectoryPath, "output/test/output.json")
        runGenerate(testPath, outPath, false)

        expect(existsSync(outPath))
            .toBeTruthy()
    })
    
    it("instantiates to calm instantiation file", () => {
        const outPath = path.join(tempDirectoryPath, "output.json")
        runGenerate(testPath, outPath, false)

        expect(existsSync(outPath))
            .toBeTruthy()

        const spec = readFileSync(outPath, { encoding: 'utf-8' })
        const parsed = JSON.parse(spec)
        expect(parsed)
            .toHaveProperty("nodes")
        expect(parsed) 
            .toHaveProperty("relationships")
    })
})