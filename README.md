# Cited History

A web app that visualizes citation history trends for papers using the OpenAlex API.

[![Windsurf](https://img.shields.io/badge/Windsurf-0B100F?logo=windsurf&logoColor=fff)](#)[![Netlify Status](https://api.netlify.com/api/v1/badges/b2923020-7fdc-45d4-be07-01f7d375ae1d/deploy-status)](https://app.netlify.com/projects/cited-history-demo/deploys)

## Features
- Input JSON with `paper_label` and `doi`
- Fetch each paper’s `counts_by_year` from OpenAlex and plot line charts (Recharts)
- Options:
  - `log`: Y-axis logarithmic scale
  - `align`: align timelines (relative years)
  - `cum`: cumulative citations
  - `legend`: legend position
- Return static images via URL: `/api/render` (server-side headless Chromium screenshot for maximum fidelity with the interactive chart)

## Demo
[Live Demo on Netlify](https://cited-history-demo.netlify.app/)

## Local development (non-Docker)
```bash
npm install
npx playwright install --with-deps chromium
npm run dev
```
Open:
- http://localhost:3000/

## API

### POST `/api/citations`
Request body: array of papers
```json
[
  {"paper_label":"MAP2B","doi":"10.1186/s13059-021-02576-9"}
]
```
Response: yearly citation data per paper.

### GET `/api/render`
Returns: `image/png`

Query params:
- `data`: base64(json)
- `log`: `true|false`
- `align`: `true|false`
- `cum`: `true|false`
- `legend`: `top|bottom|left|right`

Notes:
- `/api/render` opens `/embed?render=true&...`, waits for the page to set `window.__CHART_READY__ = true`, then takes a screenshot.

## Docker
From repo root:
```bash
docker build -t cited-history .
docker run --rm -p 3000:3000 cited-history
```
Open:
- http://localhost:3000/

Notes:
- Docker image is based on the Playwright official image (Chromium included) to ensure `/api/render` works.
