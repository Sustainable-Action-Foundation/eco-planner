"use client"

import { Action } from "@/types"
import styles from './page.module.css'
import Grid from "@/components/form/elements/grid/grid"

// TODO: Need to adapt our grid to this. We should not need to use headers. 
// We also should make sure that keyboard navigations arent weird if last row does not contain 
// an item amount equal to the rows above it.
export default function ActionsGrid({ actions }: { actions: Action[] | null }) {
  return (
    <Grid props={{ 
      className: styles['actions-grid']
    }}>
      <Grid.ColumnHeader>Year</Grid.ColumnHeader>
      <Grid.ColumnHeader>Value</Grid.ColumnHeader>
      <Grid.ColumnHeader>Action</Grid.ColumnHeader>
      <Grid.ColumnHeader>Action</Grid.ColumnHeader>
      {actions?.map(action => (
        <Grid.Cell key={action.id} tabIndex={0}>
          {action.name}
          {action.author.username}
          {action.comments.length}
          {new Date(action.createdAt).toDateString()}
          {action.description}
          {action.costEfficiency}
          {action.effects.length}
          {action.startYear} - {action.endYear}
          {action.expectedOutcome}
          {action.isEfficiency} - {action.isSufficiency} - {action.isRenewables}
          {action.projectManager}
          {action.relevantActors}
          {action.roadmap.metaRoadmap.name}
          {new Date(action.updatedAt).toDateString()}
        </Grid.Cell>
      ))}
    </Grid>
  )
}