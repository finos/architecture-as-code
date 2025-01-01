import { readFileSync, writeFileSync } from 'node:fs';
import * as graphviz from 'graphviz-cli';
import { visualizeArchitecture, visualizePattern } from './visualize';
import { generate } from '../generate/generate';

jest.mock('node:fs', () => {
    return {
        readFileSync: jest.fn(),
        writeFileSync: jest.fn()
    };
});

jest.mock('graphviz-cli', () => ({
    __esModule: true,
    ...jest.requireActual('graphviz-cli')
}));

jest.mock('./calmToDot.js', () => jest.fn());

jest.mock('../helper.js', () => {
    return {
        initLogger: () => {
            return {
                info: jest.fn(),
                debug: jest.fn(),
                error: jest.fn()
            };
        }
    };
});

jest.mock('../generate/generate');

jest.mock('../../consts', () => ({
    get CALM_META_SCHEMA_DIRECTORY() { return '../calm/draft/2024-10/meta'; }
}));

describe('visualizer', () => {
    let mockExit;

    beforeEach(() => {
        mockExit = jest.spyOn(process, 'exit')
            .mockImplementation((code) => {
                if (code != 0) {
                    throw new Error();
                }
                return undefined as never;
            });
    });

    describe('visualize architecture', () => {

        beforeEach(() => {
            (readFileSync as jest.Mock).mockReturnValue(`
            {
                "nodes": [],
                "relationships": []
            }
            `);
        });


        afterEach(() => {
            jest.resetAllMocks();
            mockExit.mockRestore();
        });

        it('reads from the given input file', async () => {
            jest.spyOn(graphviz, 'renderGraphFromSource').mockResolvedValue('<svg></svg>');

            await visualizeArchitecture('./input.json', './output.svg', false);
            expect(readFileSync).toHaveBeenCalledWith('./input.json', 'utf-8');
        });

        it('writes to the given output file', async () => {
            jest.spyOn(graphviz, 'renderGraphFromSource').mockResolvedValue('<svg></svg>');

            await visualizeArchitecture('./input.json', './output.svg', false);
            expect(writeFileSync).toHaveBeenCalledWith('./output.svg', '<svg></svg>');
        });

        it('doesnt write if an error is thrown', async () => {
            jest.spyOn(graphviz, 'renderGraphFromSource').mockRejectedValue(new Error());

            await expect(visualizeArchitecture('./input.json', './output.svg', false))
                .rejects
                .toThrow();

            expect(writeFileSync).not.toHaveBeenCalled();
            expect(mockExit).toHaveBeenCalledWith(1);
        });
    });

    describe('visualize pattern', () => {
        beforeEach(() => {
            (generate as jest.Mock).mockResolvedValue(`
            {
                "properties": {
                    "nodes": {
                        "prefixItems": []
                    },
                    "relationships": {
                        "prefixItems": []
                    }
                },
                "required": [
                    "nodes",
                    "relationships"
                ]
            }
            `);
        });


        afterEach(() => {
            jest.resetAllMocks();
        });

        it('generates architecture from the given input file', async () => {
            jest.spyOn(graphviz, 'renderGraphFromSource').mockResolvedValue('<svg></svg>');

            await visualizePattern('./input.json', './output.svg', false);
            expect(generate).toHaveBeenCalledWith('./input.json', false, true);
        });

        it('writes to the given output file', async () => {
            jest.spyOn(graphviz, 'renderGraphFromSource').mockResolvedValue('<svg></svg>');

            await visualizePattern('./input.json', './output.svg', false);
            expect(writeFileSync).toHaveBeenCalledWith('./output.svg', '<svg></svg>');
        });

        it('doesnt write if an error is thrown', async () => {
            jest.spyOn(graphviz, 'renderGraphFromSource').mockRejectedValue(new Error());

            await expect(visualizePattern('./input.json', './output.svg', false))
                .rejects
                .toThrow();
            expect(writeFileSync).not.toHaveBeenCalled();
            expect(mockExit).toHaveBeenCalledWith(1);
        });
    });
});