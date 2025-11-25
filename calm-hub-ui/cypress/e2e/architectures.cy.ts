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
        cy.contains(/web-client/i);
        cy.fixture('three-tier-calm').then(data => {
            cy.contains(/\$schema/i)
            cy.contains(data.$schema)

            cy.contains(/nodes/i);
            cy.get('[data-cy="json-renderer"]').scrollTo("bottom")
        });
    })
})
