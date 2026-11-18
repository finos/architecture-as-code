import { namespaceInfos, namespaces } from "../fixtures/constants.js";

describe('Navigation menu on a narrow screen', () => {
  beforeEach(() => {
    cy.intercept("/api/calm/auth/config", { "oidc": { "enabled": false }, "databaseMode": "standalone" })
    cy.intercept("/calm/namespaces", { "values": namespaceInfos })
    cy.intercept("/api/calm/ui/config", {})
    cy.intercept("/api/calm/extensions", { "values": [] })
  })

  it('opens above the Explore panel and goes to the chosen page', () => {
    cy.viewport(390, 844)
    cy.visit(`/#/namespace/${namespaces[0]}`);
    cy.findByRole("button", { name: "Close navigation" }).should("be.visible");

    cy.findByRole("button", { name: "Open menu" }).click();
    // click() fails if another element covers the link.
    cy.findByRole("link", { name: "Home" }).click();

    cy.location("hash").should("eq", "#/");
    cy.findByLabelText("Search the architecture catalogue").should("be.visible");
    cy.findByRole("link", { name: "Home" }).should("not.exist");
  })

  it('is modal: a click outside it only closes it', () => {
    cy.viewport(390, 844)
    cy.visit(`/#/namespace/${namespaces[0]}`);
    cy.get("html").invoke("attr", "data-theme").then((theme) => {
      cy.findByRole("button", { name: "Open menu" }).click();
      cy.focused().should("have.attr", "aria-label", "Close menu");

      // A click where the theme toggle shows lands on the backdrop.
      cy.findByRole("button", { name: /^Switch to/ }).then(($toggle) => {
        const box = $toggle[0].getBoundingClientRect();
        cy.get("body").click(box.x + box.width / 2, box.y + box.height / 2);
      });
      cy.findByRole("dialog", { name: "Menu" }).should("not.exist");
      cy.get("html").should("have.attr", "data-theme", theme);
      cy.focused().should("have.attr", "aria-label", "Open menu");
    });
  })
})

describe('Navbar brand', () => {
  it('keeps the longest names inside the centre of the navbar on a 1024px screen', () => {
    cy.intercept("/api/calm/auth/config", { "oidc": { "enabled": false }, "databaseMode": "standalone" })
    cy.intercept("/calm/namespaces", { "values": namespaceInfos })
    cy.intercept("/api/calm/extensions", { "values": [] })
    cy.intercept("/api/calm/ui/config", {
      environment: { name: "Production", colour: "warning" },
      branding: {
        organisationName: "W".repeat(64),
        applicationName: "Architecture Hub",
        logo: { light: "/api/calm/ui/branding/logo/light" },
      },
    })
    cy.intercept("/api/calm/ui/branding/logo/light", {
      headers: { "content-type": "image/svg+xml" },
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#0f766e"/></svg>',
    })
    cy.viewport(1024, 768)
    cy.visit(`/#/namespace/${namespaces[0]}`);
    cy.get("[data-testid=brand-lockup] img").should("be.visible");

    cy.get(".navbar").then(([navbar]) => {
      const link = navbar.querySelector(".navbar-center a")!.getBoundingClientRect();
      const start = navbar.querySelector(".navbar-start")!.getBoundingClientRect();
      const end = navbar.querySelector(".navbar-end")!.getBoundingClientRect();
      expect(navbar.scrollWidth, "navbar scroll width").to.be.at.most(navbar.clientWidth);
      expect(link.left, "brand left edge").to.be.at.least(start.right);
      expect(link.right, "brand right edge").to.be.at.most(end.left);
    });
  })
})
