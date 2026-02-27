const expectedNamespace = { name: "finos", description: "FINOS namespace" };
const expectedPatternId = 1;
const expectedPatternVersion = "1.0.0";

describe('Pattern Tests', () => {
    beforeEach(() => {
        cy.intercept("/calm/namespaces", {"values": [expectedNamespace]});
        cy.intercept("/calm/namespaces/finos/patterns", {"values": [expectedPatternId]});
        cy.intercept("/calm/namespaces/finos/patterns/1/versions", {"values": [expectedPatternVersion]});
        cy.intercept("/calm/namespaces/finos/patterns/1/versions/1.0.0", {
            fixture: "conference-signup-pattern"
        });
    })

    it("Displays pattern diagram by default", () => {
        cy.visit("/");
        cy.findByText(expectedNamespace.name).click();
        cy.findByText(/patterns/i).click();
        cy.findByText(/1/i).click();
        cy.findByText(/1.0.0/i).click();

        cy.findByRole("tab", { name: /diagram/i }).should("exist");
        cy.findByRole("tab", { name: /json/i }).should("exist");
        cy.get('canvas').should("exist");
    })

    it("Switches to JSON tab and displays pattern content", () => {
        cy.visit("/");
        cy.findByText(expectedNamespace.name).click();
        cy.findByText(/patterns/i).click();
        cy.findByText(/1/i).click();
        cy.findByText(/1.0.0/i).click();

        cy.findByRole("tab", { name: /json/i }).click();

        cy.fixture('conference-signup-pattern').then(data => {
            cy.contains(/\$schema/i).should("exist");
            cy.contains(data.$schema).should("exist");

            cy.contains(/\$id/i).should("exist");
            cy.contains(data.$id).should("exist");

            cy.contains(/title/i).should("exist");
            cy.contains(data.title).should("exist");

            cy.contains(/description/i).should("exist");
            cy.contains(data.description).should("exist");

            cy.contains(/prefixItems/i).should("exist");
        });
    })
})
