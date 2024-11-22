const pages: Array<string> = [
  'dashboard',
  'info',
  'metaRoadmap/createMetaRoadmap',
  `metaRoadmap/${Cypress.env('meta_roadmap_id')}`,
  `metaRoadmap/${Cypress.env('meta_roadmap_id')}/editMetaRoadmap`,
  'roadmap/createRoadmap',
  `roadmap/${Cypress.env('roadmap_id')}`,
  `roadmap/${Cypress.env('roadmap_id')}/editRoadmap`,
  `goal/createGoal`,
  `goal/${Cypress.env('goal_id')}`,
  `goal/${Cypress.env('goal_id')}/editGoal`,
  `action/createAction`,
  `action/${Cypress.env('action_id')}`,
  `action/${Cypress.env('action_id')}/editAction`,
  'user/admin'
]

describe('Screenshot tests', () => {

  before(() => {
    // First visit signup
    cy.visit('/signup').screenshot('signup', {capture: "fullPage", overwrite: true})

    // Then visit Login
    cy.visit('/login').screenshot('login', {capture: "fullPage", overwrite: true})
    cy.get('input[type="text"]').type(Cypress.env('user_name')) // TODO: Probably do this in some nicer way :)
    cy.get('input[type="password"]').type(Cypress.env('user_password'))
    cy.get('input[type="submit"]').click().wait(500) // TODO: Should probably check that login api returns status 200 
  })

  it('screenshots page', () => {
    pages.forEach(page => {
      cy.visit(`/${page}`)
        .wait(300)
        .screenshot(page.replaceAll('/', '_'), {capture: "fullPage", overwrite: true})
    })
  })
})