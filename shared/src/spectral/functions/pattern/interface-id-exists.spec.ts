import { interfaceIdExists } from './interface-id-exists';

describe('interfaceIdExists', () => {
    it('should return an empty array when there is no input', () => {
        const input = null;
        const context = {
            document: {
                data: {}
            }
        };

        const result = interfaceIdExists(input, null, context);
        expect(result).toEqual([]);
    });

    it('should return an empty array when the ID exists', () => {
        const input = 'intf1';
        const context = {
            document: {
                data: {
                    interfaces: {
                        prefixItems: [
                            {properties: {'unique-id': {const: 'intf1'}}} // will match this interface
                        ]
                    }
                }
            }
        };

        const result = interfaceIdExists(input, null, context);
        expect(result).toEqual([]);
    });

    it('should return a message when the ID does not exist', () => {
        const input = 'intf2';
        const context = {
            document: {
                data: {
                    interfaces: {
                        prefixItems: [
                            {properties: {'unique-id': {const: 'intf1'}}}
                        ]
                    }
                }
            },
            path: ['/relationships/0/connects/destination/interface']
        };

        const result = interfaceIdExists(input, null, context);
        expect(result.length).toBe(1);
        expect(result[0].message).toBe(`'${input}' does not refer to the unique-id of an existing interface.`);
        expect(result[0].path).toEqual(['/relationships/0/connects/destination/interface']);
    });
});