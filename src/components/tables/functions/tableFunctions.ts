import { getLocalStorage, getSessionStorage, setLocalStorage, setSessionStorage } from "@/functions/localStorage";
import { GoalSortBy, ViewMode } from "../goals";

/** Retrieves the view mode for a roadmap from storage. */
export function getStoredViewMode(id?: string) {
  let viewMode: ViewMode | undefined | null;
  // Check if this goal has a stored view mode
  if (id) {
    viewMode = getSessionStorage(id + '_viewMode') as ViewMode | undefined | null;
  }
  // Check if the user has a stored latest view mode if no id is provided or the returned viewMode is invalid
  if (!Object.values(ViewMode).includes(viewMode as ViewMode) || !viewMode) {
    viewMode = getLocalStorage("viewMode") as ViewMode | undefined | null;
  }
  // Default to tree view if no valid view mode is found
  if (!Object.values(ViewMode).includes(viewMode as ViewMode) || !viewMode) {
    if (viewMode != null) {
      console.log("Invalid view mode in storage, defaulting to tree view.");
    }
    setLocalStorage("viewMode", ViewMode.Tree);
    viewMode = ViewMode.Tree;
  }
  return viewMode;
}

/** Stores the view mode for a roadmap in storage. */
export function setStoredViewMode(viewMode: string, id?: string) {
  if (id) {
    setSessionStorage(id + "_viewMode", viewMode)
  };
  setLocalStorage("viewMode", viewMode);
}

export function getStoredGoalSortBy() {
  let sortBy: GoalSortBy | undefined | null;
  // Check if the user has any stored latest goal sort
  sortBy = getLocalStorage("goalSortBy") as GoalSortBy | undefined | null;
  // Use default sorting if no saved sort is found
  if (!Object.values(GoalSortBy).includes(sortBy as GoalSortBy) || !sortBy) {
    if (sortBy != null) {
      console.log("Invalid sorting method in storage, using default sorting method");
    }

    setLocalStorage("goalSortBy", GoalSortBy.Default);
    sortBy = GoalSortBy.Default;
  }
  return sortBy;
}

export function setStoredGoalSortBy(sortBy: GoalSortBy) {
  setLocalStorage("goalSortBy", sortBy);
}