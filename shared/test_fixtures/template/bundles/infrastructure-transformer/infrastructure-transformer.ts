/* eslint-disable  @typescript-eslint/no-explicit-any */
import { CalmTemplateTransformer } from '@finos/calm-shared';
import {CalmCoreSchema} from "../../../../src/types/core-types";
import {
    Architecture,
    CalmContainerImageInterface,
    CalmCore,
    CalmHostPortInterface, CalmInterface,
    CalmPortInterface
} from "../../../../src";

export default class InfrastructureTransformer implements CalmTemplateTransformer {
    registerTemplateHelpers() {
        return {};
    }
    getTransformedModel(calmJson: string): any {
        const calmSchema: CalmCoreSchema = JSON.parse(calmJson);
        const calmCore: CalmCore = CalmCore.fromJson(calmSchema);

        let namespaceName: string;
        let databaseName: string;
        let databasePort: number;
        let applicationName: string;
        let applicationPort: number;
        let lbHost: string;
        let lbPort: number;
        let applicationImage: string;
        let secure: boolean;


        namespaceName = calmCore.metadata.data['kubernetes']['namespace']


        calmCore.nodes.forEach((node) => {
            if (node.nodeType === "system"){
                  const microSegControl = node.controls.find(control =>
                    control.requirements?.some(req =>
                        req.controlConfigUrl["$id"].includes("micro-segmentation")
                    )
                );
                if (microSegControl) {
                   secure = true;
                }

            }else if (node.nodeType === "database"){
                databaseName = node.uniqueId
                databasePort = node.interfaces.find(
                    (interfaceObj): interfaceObj is CalmPortInterface => interfaceObj instanceof CalmPortInterface
                )?.port;
            }else if (node.nodeType === "service"){
                applicationName = node.uniqueId
                applicationPort = node.interfaces.find(
                    (interfaceObj): interfaceObj is CalmPortInterface => interfaceObj instanceof CalmPortInterface
                )?.port;

                applicationImage = node.interfaces.find(
                    (interfaceObj): interfaceObj is CalmContainerImageInterface => interfaceObj instanceof CalmContainerImageInterface
                )?.image;


            }else if (node.nodeType === "network"){
               const hostPort = node.interfaces.find(
                    (interfaceObj): interfaceObj is CalmHostPortInterface => interfaceObj instanceof CalmHostPortInterface
                );

                lbHost = hostPort?.host;
                lbPort = hostPort?.port;
            }
        })



        return { document: {
            "namespaceName": namespaceName,
            "databaseName": databaseName,
            "appName": applicationName,
            "applicationPort": applicationPort,
            "applicationImage":applicationImage,
            "lbPort": lbPort,
            "databasePort": databasePort,
            "secure": secure
         } };
    }
}
