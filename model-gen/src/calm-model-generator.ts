import * as path from 'path';
import * as fs from 'fs';
import * as $RefParser from "@apidevtools/json-schema-ref-parser";
import { compile } from 'json-schema-to-typescript';
// @ts-ignore
import { LinkedJSONSchema } from "@apidevtools/json-schema-ref-parser";

class CalmModelGenerator {
    private ensureOutputDirectoryExists(outputDirectory: string): void {
        if (!fs.existsSync(outputDirectory)) {
            fs.mkdirSync(outputDirectory, { recursive: true });
        }
    }

    // Generate TypeScript definitions from JSON schemas
    private async generateTypeDefinitions(inputDirectory: string, outputDirectory: string): Promise<void> {

     const generateCustomName: (schema: LinkedJSONSchema, keyNameFromDefinition: string | undefined) => string | undefined = (schema, keyNameFromDefinition) => {
        if (keyNameFromDefinition) {
            return keyNameFromDefinition;
        }
        if (schema && schema.$id) {
            // Use the $id of the schema to generate a name (e.g., based on the file name or URI)
            const match = schema.$id.match(/[^/]+(?=\.json$)/); // Match the part before .json in the URL
            if (match) {
                return match[0]; // Return the name without the file extension
            }
        }
        if (schema.title) {
            return schema.title.replace(/\s+/g, '');
        }
        return undefined;
    };


        const options = {
          dereference: {
              circular: "ignore",
              externalReferenceResolution: "relative"
          },
          resolve: {
              external: true
          },
          continueOnError: false
      }
        const files = fs.readdirSync(inputDirectory).filter(file => file !== "calm.json");

        for (const file of files) {
            const filePath = path.join(inputDirectory, file)
            try {
                const schema = await $RefParser.parse(filePath);

                const typeName = path.basename(file, '.json');

                // @ts-ignore
                const ts = await compile(schema, typeName, {
                    bannerComment: '',  isUnreachableDefinition: true, cwd: inputDirectory, inferStringEnumKeysFromValues: true, $refOptions:options, customName: generateCustomName  });

                const tsFilePath = path.join(outputDirectory, `${typeName}.d.ts`);
                fs.writeFileSync(tsFilePath, ts);
                console.log(`Generated TypeScript for ${typeName} in ${tsFilePath}`);
            } catch (error) {
                console.error(`Error generating types for ${file}:`, error);
            }
        }
    }

    // Execute method to run the whole process
    public async execute(inputDirectory: string, outputDirectory: string): Promise<void> {
        // Ensure the output directory exists
        this.ensureOutputDirectoryExists(outputDirectory);

        // Generate TypeScript definitions from the input schemas
        await this.generateTypeDefinitions(inputDirectory, outputDirectory);
    }
}

export default CalmModelGenerator;
