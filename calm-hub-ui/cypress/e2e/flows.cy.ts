const expectedNamespace = "finos"
const expectedFlowId = 1;
const expectedFlowVersion = "1.0.0";

describe('Pattern Tests', () => {
    beforeEach(() => {
        cy.intercept("/calm/namespaces", {"values": [expectedNamespace]});
        cy.intercept("/calm/namespaces/finos/flows", {"values": [expectedFlowId]});
        cy.intercept("/calm/namespaces/finos/flows/1/versions", {"values": [expectedFlowVersion]});
        cy.intercept("/calm/namespaces/finos/flows/1/versions/1.0.0", {
            fixture: "update-account-flow"
        });
    })

    it("Displays flow JSON successfully", () => {
        cy.visit("/");
        cy.findByText(expectedNamespace).click();
        cy.findByText(/flows/i).click();
        cy.findByText(/1/i).click();
        cy.findByText(/1.0.0/i).click();

        cy.fixture('update-account-flow').then(data => {
            cy.contains(/\$schema/i).should("exist");
            cy.contains(data.$schema).should("exist");

            cy.contains(/\$id/i).should("exist");
            cy.contains(data.$id).should("exist");

            cy.contains(/unique-id/i).should("exist");
            cy.contains(data["unique-id"]).should("exist");

            cy.contains(/name/i).should("exist");
            cy.contains(data.name).should("exist");

            cy.contains(/description/i).should("exist");
            cy.contains(data.description).should("exist");

            cy.contains(/transitions/i).should("exist");

            Object.entries(data.transitions[0]).forEach(([key, value]) => {
                cy.contains(key).should("exist");
                cy.contains(value as string).should("exist");
            })

        });
    })
})
