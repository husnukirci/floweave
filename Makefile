# floweave — Make targets
# Run `make` or `make help` to list available targets.

.DEFAULT_GOAL := help

.PHONY: help install dev dev-server test build build-wc clean up docker-build docker-run

help:  ## Show this help
	@echo "floweave — make targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	 | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install:  ## Install dependencies and prepare git hooks
	npm ci

dev:  ## Start the Vite dev server (run `make dev-server` in another terminal for the LLM proxy)
	npm run dev

dev-server:  ## Start the Hono LLM proxy on :3001 — needs ANTHROPIC_API_KEY in .env
	npm run dev:server

test:  ## Local quality gates: typecheck + lint + unit tests
	npm run typecheck
	npm run lint
	npm test

build:  ## Production build (typecheck + vite build of the dev SPA)
	npm run build

build-wc:  ## Build the embeddable Web Component bundle into dist-wc/
	npm run build:wc

clean:  ## Remove node_modules, dist, coverage, tsbuildinfo
	rm -rf node_modules dist coverage .tsbuildinfo

up:  ## Run the full stack (proxy + static) — Phase 9 deliverable
	@echo "make up: not yet implemented — Docker compose lands in Phase 9 (see PLAN.md §6 Phase 9)."
	@exit 1

docker-build:  ## Build the production Docker image — Phase 9 deliverable
	@echo "make docker-build: not yet implemented — see PLAN.md §6 Phase 9."
	@exit 1

docker-run:  ## Run the Docker image locally — Phase 9 deliverable
	@echo "make docker-run: not yet implemented — see PLAN.md §6 Phase 9."
	@exit 1
