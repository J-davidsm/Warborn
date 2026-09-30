# Warborn delivery workflow

The project owner requests that every Warborn update be installed locally and pushed to GitHub after verification, without a separate confirmation request.

- Run the relevant regression checks before release.
- Back up the installed desktop archive before replacing it; preserve saved games and the existing application wrapper.
- Commit and push the update to the existing GitHub deployment branch without force-pushing.
- Verify the GitHub Pages build and live files before reporting publication complete.
- If installation or publication fails, report the specific blocker rather than claiming success.
