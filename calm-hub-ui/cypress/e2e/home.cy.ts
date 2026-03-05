import {namespaceInfos, namespaces, resourceTypes} from "../fixtures/constants.js";

describe('Home page tests', () => {
  beforeEach(() => {
    cy.intercept("/calm/namespaces", {"values": namespaceInfos})
  })

  it('Loads initial screen successfully', () => {
    cy.visit('/');
    cy.findByText("Explore").should("exist");
    cy.findByText("Namespaces").should("exist");
    namespaces.forEach(namespace => cy.findByText(namespace).should("exist"));
    cy.findByText(namespaces[0]).click();
    resourceTypes.forEach(resourceType => { cy.findByText(resourceType).should("exist"); });
  })

  context("Sidebar collapse", () => {
    it("Collapses and expands the sidebar", () => {
      cy.visit('/');
      cy.findByText("Explore").should("exist");

      cy.findByLabelText("Collapse sidebar").click();
      cy.findByText("Explore").should("not.exist");

      cy.findByLabelText("Expand sidebar").click();
      cy.findByText("Explore").should("exist");
    })
  })

  context("Wide screen tests", () => {
    it("Finds navigation items", () => {
      cy.viewport('macbook-16')
      cy.visit('/');
      cy.findByRole("link", { name: "Hub" })
      cy.findByRole("link", { name: "Visualizer" })
    })
  })

  context("Collapsed screen tests", () => {
    it("Finds navigation items", () => {
      cy.viewport(1000, 600)
      cy.visit('/');
      cy.findByRole("button", { name: "Open Menu" }).click();
      cy.findByRole("link", { name: "Hub" })
      cy.findByRole("link", { name: "Visualizer" })
    })
  })
})
