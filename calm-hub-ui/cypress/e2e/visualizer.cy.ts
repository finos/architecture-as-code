describe("Visualizer page tests", () => {
    it("Displays visualizer on navigation", () => {
        cy.viewport('macbook-16')
        cy.visit("/");

        cy.findByRole("link", { name: "Visualizer" }).click();

        cy.get('canvas').should("not.exist");
        cy.findByText(/drag and drop your file here/i).should("exist");

        cy.fixture("three-tier-calm", null).as('architecture');
        cy.get('input[type=file]').selectFile("@architecture", {force: true})

        cy.get('canvas').should("exist");
        cy.findByText(/relationship descriptions/i).should("exist");
        cy.findByText(/node descriptions/i).should("exist");
    })
})
