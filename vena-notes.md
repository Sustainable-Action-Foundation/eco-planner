## Recipe Editor
- State and rerender issues with the variable components not updating correctly or fighting with every rerender
  - Have a look at the handle* functions for the recipeEditor.tsx and variables.tsx files and if inputs are controlled or not. (especially `unit` input)
  
- Add debounce to especially the eq input but on everything is probably wise.

- Find the cause of the error `can't convert undefined to object` that gets thrown by something in the calculate function in the recipe context provider.

- Filter which errors are shown to the user. Like `'null' link on data series 'name'` isn't that helpful since the link prop is optional. Maybe warn instead and formulate it better. Like don't scream at the user for using the tool like intended lol.
  - This could be done with adding a new Error type that is a `HardWarning` or `BreakingWarning` or `SilentError` to handle things with more nuance while still breaking the flow. That code is built as a map that constructs a bunch of async functions to be await so not hard stopping will cause issues.

- Localize some hard coded strings like the default variable name is `varN` which isn't great. There are probably others I missed.

### To Axel
- Please make all the UI/UX very pretty and nice plz :3

## Suggested Recipes
- They are templates with varying degrees of completeness. Some point you to a specific data series to take from and only allow you to modify a scalar (which would resave the recipe with a new hash) while some mainly provide an equation template with no pointers on the data series or external datasets.
- With all that said, make smarter suggested recipes. In copy and scale, derive more from the information provided by the context of scaling to and from a place.

## Goal form
- Implement a nice way of choosing wether you wanna scale or combine other data series. Maybe selectively show recipe suggestions based on that choice?

## Recipe Parser
- It should be in a pretty good state now. Sure there might be things that should be looked at but it should be in working order so leaving it should be fine :upside_down_face:

- All errors and warnings are hard coded in english for the sake of convenience for me and since we pass third part made error messages like mathjs to the user anyhow so it being all in english is fine for now.

## Seeding
- Need to add recipes to inherit 1:1 from national v1 to v2 and scaling recipes to inherit from national to regional.
- Continue with seeding the rest of the things that should be seeded. (I got side tracked on the recipe seeding since it lead to me needing to fix and implement stuff in the recipe parser and editor).