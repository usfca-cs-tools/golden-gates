# Front-end refactor

I'd like to refactor the front-end UI. The command palette seemed like a good idea but colleagues have offered suggestions:

## Problems

1. The large command palette which relies on type-ahead seems like a power user feature. They're accustomed to Digital
which has a sidebar on the left side. 
1. Perhaps seeing all the circuit elements would be more accessible to students who aren't familiar with digital design. 
1. The command palette blends verbs (Run circuit, Test circuit) with items you can insert (And gate, mux, custom circuits in 
the project directory)

## Possible solutions

Here's a design I'd like to pursue, although I'm open to other ideas which address the problems given above.

### Sidebar

1. Add a left sidebar for items you can insert, removing the Circuits menu in the tab bar in favor of the sidebar. 
1. We'll need an icon in the tab bar to show/hide the sidebar. Prime icons probably has a sidebar icon.
1. The sidebar should show a hierarchical tree for each category. I'm not sure whether we should let the user
close tree branches, or just use hierarchy for categorization
1. The tree branch for custom circuits should have the leaf name of the directory you're working in, like
we do for the app title bar
1. Perhaps the visual style of the sidebar can be similar to the property pane
1. However, I'm sensitive to the problem that when both the sidebar and property pane are open, there isn't that
much room for the circuit canvas. So I'd like to be visually concise for the sidebar. It shouldn't dominate the
window geometry.

### Command palette
1. Keep the command palette for circuit actions/verbs and the file actions
2. Add Again (A) to the palette proper rather than the tip on the right side
3. Remove Recently used
4. Remove type-ahead since the palette will contain a lot fewer items

## Branch

1. I'd like to do this work on a branch so I can A/B test it with the most recent release build from the main branch 
