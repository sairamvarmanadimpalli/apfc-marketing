# Claude Code Prompt — APFC Tool Deployment

Copy-paste this entire block into Claude Code in the project directory.

---

I have a two-part app at `apfc-deploy/`:
- `worker/` — Cloudflare Worker (TGSPDCL bill fetcher)
- `frontend/` — Vite + React static site for GitHub Pages

Please do the following, in order, asking me only when input is genuinely needed
(never for things you can infer from the README):

## 1. Initialise the git repo and push to GitHub

- Run `git init -b main` at `apfc-deploy/` root
- Stage and commit everything as "Initial APFC pitch tool"
- Ask me for my GitHub username and the repo name (default: `apfc-pitch`)
- Add the remote and push

If `gh` CLI is available, offer to create the repo via `gh repo create` so I
don't have to do it in the browser.

## 2. Deploy the Worker

- `cd worker && npm install -g wrangler` (or use `npx wrangler`)
- Run `wrangler login` and pause for me to complete browser auth
- Run `wrangler deploy`
- Capture the deployed URL from wrangler output
- Verify with: `curl "<URL>/api/health"` then `curl "<URL>/api/bill?scno=113400807&type=LT"`
- Confirm the second call returns JSON with `ok: true` and a `data.consumerName` field

## 3. Wire the Worker URL into the frontend

- Edit `frontend/src/App.jsx` and replace the `DEFAULT_API_BASE` constant
  with the deployed Worker URL from step 2
- `git add`, commit "Wire production worker URL", `git push`

## 4. Enable GitHub Pages

- Open the repo Settings → Pages page in the browser (use `gh repo view --web`
  if available) and tell me to set Source = "GitHub Actions"
- Wait for the deploy.yml workflow run to complete
- Output the Pages URL (`https://<user>.github.io/<repo>/`) and verify it
  loads with `curl -I`

## 5. Smoke test end-to-end

- Open the Pages URL in my browser via `xdg-open` or `open` (or just print the URL)
- Tell me what to enter: SC number `113400807`, click Fetch
- Confirm the bill fields populate

## 6. Optional: custom domains

If I confirm I want it, walk me through setting up:
- `apfc.deepandwide.in` → GitHub Pages (CNAME + Pages settings + `frontend/public/CNAME` file + `vite.config.js` base="/")
- `apfc-api.deepandwide.in` → Cloudflare Worker (CNAME + Cloudflare custom domain)

Then update `DEFAULT_API_BASE` and `ALLOWED_ORIGINS` in the worker, redeploy.

## Notes

- All commands assume Linux/macOS. If on Windows, use Git Bash or WSL.
- If `npm install -g wrangler` needs sudo and that's awkward, use `npx wrangler` for everything.
- If anything fails, show me the error and propose a fix — don't loop trying.
- The README at `apfc-deploy/README.md` has the full reference if you need it.
