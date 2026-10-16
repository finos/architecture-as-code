/* SPDX-License-Identifier: Apache-2.0 */
const adrRoute = '#/finos/adrs/1/1';
const longCell = 'evidence'.repeat(12);
const markdown = `| Choice | Input | Evidence | Review | Cost | Outcome |
| --- | --- | --- | --- | --- | --- |
| Queue | ${longCell} | ${longCell} | ${longCell} | 2 | accepted |

| A | B |
| --- | --- |
| 1 | 2 |

~~removed~~

- [x] reviewed

Decision[^note]

[^note]: Independent evidence`;

for (const [width, height] of [
    [1366, 900],
    [390, 844],
]) {
    for (const theme of ['light', 'dark']) {
        describe(`ADR Markdown at ${width}px in ${theme} mode`, () => {
            beforeEach(() => {
                cy.viewport(width, height);
                cy.intercept('GET', '/api/calm/**', { values: [] });
                cy.intercept('GET', '/api/calm/auth/config', { oidc: { enabled: false }, databaseMode: 'mongo' });
                cy.intercept('GET', '/api/calm/user-access/current', []);
                cy.intercept('GET', '/api/calm/namespaces', { values: [{ name: 'finos', description: 'Test namespace' }] });
                cy.intercept('GET', '/api/calm/namespaces/counts', {
                    values: [
                        { namespace: 'finos', architectures: 0, patterns: 0, flows: 0, standards: 0, adrs: 1, interfaces: 0, total: 1 },
                    ],
                });
                cy.fixture('example-adr').then((data) => {
                    data.adr.contextAndProblemStatement = markdown;
                    data.adr.consideredOptions[0].description = markdown;
                    data.adr.decisionOutcome.chosenOption.description = markdown;
                    data.adr.decisionOutcome.rationale = markdown;
                    cy.intercept('GET', '/api/calm/namespaces/finos/adrs/1/revisions/1', data).as('adr');
                });
                cy.visit(`/${adrRoute}`, {
                    onBeforeLoad(win) {
                        win.localStorage.setItem('calm-theme', theme);
                    },
                });
                cy.wait('@adr');
                cy.contains('h1', 'Example ADR').should('be.visible');
            });

            it('renders GFM, contains table overflow and keeps footnote navigation on the ADR route', () => {
                cy.get('.adr-markdown table').should('have.length', 8);
                cy.get('.adr-markdown del').first().should('have.text', 'removed');
                cy.get('.adr-markdown input[type="checkbox"]').first().should('be.checked').and('be.disabled');
                cy.get('.adr-markdown-table').first().should('have.attr', 'tabindex', '0').and('have.css', 'overflow-x', 'auto');
                cy.get('.adr-markdown-table').eq(1).should('not.have.attr', 'tabindex');
                cy.get('.adr-markdown-table').eq(2).closest('.collapse').find('> input[type="checkbox"]').check();
                cy.get('.adr-markdown-table').eq(2).should('have.attr', 'tabindex', '0');
                cy.get('.adr-markdown-table').eq(3).should('not.have.attr', 'tabindex');
                cy.get('.adr-markdown-table')
                    .first()
                    .then(($region) => {
                        expect($region[0].scrollWidth).to.be.greaterThan($region[0].clientWidth);
                        expect($region.find('table').css('display')).to.equal('table');
                    });
                cy.get('.adr-markdown-table').first().focus();
                cy.focused().should('have.attr', 'aria-label', 'Context and problem table at line 1');
                cy.get('.adr-markdown-table')
                    .first()
                    .scrollTo('right')
                    .should(($region) => {
                        expect($region[0].scrollLeft).to.be.greaterThan(0);
                    });
                cy.document().then((doc) => {
                    expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth + 1);
                    const ids = Array.from(doc.querySelectorAll('.adr-markdown [id]'), (element) => element.id);
                    expect(new Set(ids).size).to.equal(ids.length);
                    const labels = Array.from(doc.querySelectorAll('.adr-markdown-table'), (element) => element.getAttribute('aria-label'));
                    expect(new Set(labels).size).to.equal(labels.length);
                });
                cy.get('.adr-markdown h2.sr-only').first().should('have.css', 'position', 'absolute').and('have.css', 'width', '1px');
                cy.get('.adr-markdown a[data-footnote-ref]').first().click();
                cy.location('hash').should('equal', adrRoute);
                cy.get('.adr-markdown a[data-footnote-backref]').first().click();
                cy.location('hash').should('equal', adrRoute);
                cy.get('.adr-markdown-table').first().scrollTo('left').scrollIntoView();
                cy.screenshot(`adr-gfm-${width}-${theme}`, { capture: 'viewport' });
            });
        });
    }
}
