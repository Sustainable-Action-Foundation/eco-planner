const pages: Array<string> = [
  '',
  'dashboard',
  'info',
  'verify',
  'verify/verify',
  'metaRoadmap/create',
  `metaRoadmap/${Cypress.env('meta_roadmap_id')}`,
  `metaRoadmap/${Cypress.env('meta_roadmap_id')}/edit`,
  'roadmap/create',
  `roadmap/${Cypress.env('roadmap_id')}`,
  `roadmap/${Cypress.env('roadmap_id')}/edit`,
  `goal/create`,
  `goal/${Cypress.env('goal_id')}`,
  `goal/${Cypress.env('goal_id')}/edit`,
  `action/create`,
  `action/${Cypress.env('action_id')}`,
  `action/${Cypress.env('action_id')}/edit`,
  'user/admin'
]

describe('Screenshot tests', () => {

  before(() => {
    // First visit signup
    cy.visit('/signup').screenshot('signup', {capture: "fullPage", overwrite: true})

    // Then visit Login
    cy.visit('/login').screenshot('login', {capture: "fullPage", overwrite: true})
    cy.get('input[type="text"]').type(Cypress.env('user_name'))
    cy.get('input[type="password"]').type(Cypress.env('user_password'))
    cy.get('input[type="submit"]').click().wait(500) // TODO: Should probably check that login api returns status 200 
  })

  it('screenshots page', () => {
    pages.forEach(page => {
      cy.visit(`/${page}`)
    
      // If the page is scrollable we style our sidebar
      // We do this to prevent our sticky sidebar from duplicating in our screenshots 
      cy.window().then((win) => {
        const isScrollable = win.document.documentElement.scrollHeight > win.innerHeight;

        if (isScrollable) {
          cy.get('aside')
            .first()
            .invoke('css', 'position', 'relative')
            .invoke('css', 'height', 'auto');
        }
      });

      cy.wait(500)
      cy.screenshot(page.replaceAll('/', '_'), {capture: "fullPage", overwrite: true})
    })
  })
})