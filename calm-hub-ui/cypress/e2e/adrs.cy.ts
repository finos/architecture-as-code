const expectedNamespace = "finos"
const expectedAdrId = 1;
const expectedAdrRevision = 2;

describe('Pattern Tests', () => {
    beforeEach(() => {
        cy.intercept("/calm/namespaces", {"values": [expectedNamespace]});
        cy.intercept("/calm/namespaces/finos/adrs", {"values": [expectedAdrId]});
        cy.intercept("/calm/namespaces/finos/adrs/1/revisions", {"values": [expectedAdrRevision]});
        cy.intercept(`/calm/namespaces/finos/adrs/1/revisions/${expectedAdrRevision}`, {
            fixture: "example-adr"
        });
    })

    it("Displays ADR JSON successfully", () => {
        cy.visit("/");
        cy.findByText(expectedNamespace).click();
        cy.findByText(/adrs/i).click();
        cy.findByText(/1/i).click();
        cy.findByText(expectedAdrRevision).click();

        cy.fixture('example-adr').then(data => {
            cy.contains(/id/i).should("exist");
            cy.contains(data.id).should("exist");

            cy.contains(/namespace/i).should("exist");
            cy.contains(data.namespace).should("exist");

            cy.contains(data.revision).should("exist");

            cy.contains(data.adr.title).should("exist");
            cy.contains(data.adr.status, {
                matchCase: false
            }).should("exist");
            cy.contains(/context and problem/i).should("exist")
            cy.contains(data.adr.contextAndProblemStatement).should("exist");

            cy.contains(/decision drivers/i).should("exist")
            cy.contains(/considered options/i).should("exist")
            cy.contains(/decision outcome/i).should("exist")

        });
    })
})
