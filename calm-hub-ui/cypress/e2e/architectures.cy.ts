const expectedNamespace = "finos"
const expectedArchitectureId = 1;
const expectedArchitectureVersion = "1.0.0";

describe('Architecture Tests', () => {
    beforeEach(() => {
        cy.intercept("/calm/namespaces", {"values": [expectedNamespace]});
        cy.intercept("/calm/namespaces/finos/architectures", {"values": [expectedArchitectureId]});
        cy.intercept("/calm/namespaces/finos/architectures/1/versions", {"values": [expectedArchitectureVersion]});
        cy.intercept("/calm/namespaces/finos/architectures/1/versions/1.0.0", {
            fixture: "three-tier-calm.json"
        });
    })

    it("Displays architecture JSON successfully", () => {
        cy.visit("/");
        cy.findByText(expectedNamespace).click();
        cy.findByText(/architectures/i).click();
        cy.findByText(/1/i).click();
        cy.findByText(/1.0.0/i).click();

        cy.findByText(/relationship descriptions/i).should("exist");
        cy.findByText(/node descriptions/i).should("exist");

        cy.findByRole("tab", { name: /json/i}).click();

        cy.fixture('three-tier-calm').then(data => {
            cy.contains(/\$schema/i).should("exist");
            cy.contains(data.$schema).should("exist");
            cy.contains(/id/i).should("exist");

            cy.contains(/nodes/i).should("exist");

            Object.entries(data.nodes[0]).forEach(([key, value]) => {
                cy.contains(key).should("exist");
                cy.contains(value as string).should("exist");
            })

            cy.contains(/unique-id/i).should("exist");
            cy.contains(data.nodes[0]["unique-id"]).should("exist");

            cy.contains(/name/i).should("exist");
            cy.contains(data.nodes[0]["name"]).should("exist");

            cy.contains(/description/i).should("exist");
            cy.contains(data.nodes[0]["description"]).should("exist");

            cy.contains(/node-type/i).should("exist");
            cy.contains(data.nodes[0]["node-type"]).should("exist");
        });
    })
})
