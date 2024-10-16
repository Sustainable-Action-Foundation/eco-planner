const pages: Array<string> = [
  'dashboard',
  'info',
  'metaRoadmap/createMetaRoadmap',
  `metaRoadmap/${Cypress.env('meta_roadmap_id')}`,
  `metaRoadmap/${Cypress.env('meta_roadmap_id')}/editMetaRoadmap`,
  'roadmap/createRoadmap',
  `roadmap/${Cypress.env('roadmap_id')}`,
  `roadmap/${Cypress.env('roadmap_id')}/editRoadmap`,
  `roadmap/${Cypress.env('roadmap_id')}/goal/createGoal`,
  `roadmap/${Cypress.env('roadmap_id')}/goal/${Cypress.env('goal_id')}`,
  `roadmap/${Cypress.env('roadmap_id')}/goal/${Cypress.env('goal_id')}/editGoal`,
  `roadmap/${Cypress.env('roadmap_id')}/goal/${Cypress.env('goal_id')}/action/createAction`,
  `roadmap/${Cypress.env('roadmap_id')}/goal/${Cypress.env('goal_id')}/action/${Cypress.env('action_id')}`,
  `roadmap/${Cypress.env('roadmap_id')}/goal/${Cypress.env('goal_id')}/action/${Cypress.env('action_id')}/editAction`,
  'user/admin'
]

describe('Screenshot tests', () => {

  before(() => {
    // First visit signup
    cy.visit('/signup').screenshot('screenshot', {capture: "fullPage"})

    // Then visit Login
    cy.visit('/login').screenshot('screenshot', {capture: "fullPage"})
    cy.get('input[type="text"]').type(Cypress.env('user_name')) // TODO: Probably do this in some nicer way :)
    cy.get('input[type="password"]').type(Cypress.env('user_password'))
    cy.get('input[type="submit"]').click().wait(500) // TODO: Should probably check that login api returns status 200 
  })

  it('screenshots page', () => {
    pages.forEach(page => {
      cy.visit(`/${page}`).wait(300).screenshot('screenshot', {capture: "fullPage"})
    })
  })
})