# MeshCore Ninja — build orchestration for the static web app and the Go API.
#
# Run `make` (or `make help`) to list targets.

# --- config ------------------------------------------------------------------

API_DIR    := api
API_BIN    := $(API_DIR)/bin/meshcore-ninja-api
API_ADDR   ?= :8089
DATA_DIR   ?= data
GO         ?= go
NPM        ?= npm

# Pretty-print: every target with a `## comment` shows up in `make help`.
.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# --- combined ----------------------------------------------------------------

.PHONY: build
build: build-api build-web ## Build both the Go API and the static web app

.PHONY: test
test: test-api test-web ## Run all tests (Go + data validation)

.PHONY: clean
clean: clean-api clean-web ## Remove all build artifacts

# --- web (SvelteKit) ---------------------------------------------------------

node_modules: package.json package-lock.json
	$(NPM) ci
	@touch node_modules

.PHONY: install
install: node_modules ## Install web dependencies (npm ci)

.PHONY: dev
dev: node_modules ## Run the web dev server (vite)
	$(NPM) run dev

.PHONY: build-web
build-web: node_modules ## Build the static site into build/
	$(NPM) run build

.PHONY: preview
preview: node_modules ## Preview the production web build
	$(NPM) run preview

.PHONY: data
data: node_modules ## Regenerate data.json / schema from data/ YAML
	$(NPM) run build:data

.PHONY: test-web
test-web: node_modules ## Validate all YAML against the schema
	$(NPM) test

.PHONY: clean-web
clean-web: ## Remove web build output
	rm -rf build .svelte-kit

# --- Go API ------------------------------------------------------------------

.PHONY: build-api
build-api: ## Compile the Go API to api/bin/
	cd $(API_DIR) && $(GO) build -o bin/meshcore-ninja-api .

.PHONY: run-api
run-api: ## Run the Go API (override DATA_DIR/API_ADDR as needed)
	cd $(API_DIR) && $(GO) run . --data ../$(DATA_DIR) --addr $(API_ADDR)

.PHONY: test-api
test-api: ## Run Go tests
	cd $(API_DIR) && $(GO) test ./...

.PHONY: vet
vet: ## Run go vet on the API
	cd $(API_DIR) && $(GO) vet ./...

.PHONY: fmt
fmt: ## Format the Go code
	cd $(API_DIR) && $(GO) fmt ./...

.PHONY: tidy
tidy: ## Tidy the Go module
	cd $(API_DIR) && $(GO) mod tidy

.PHONY: clean-api
clean-api: ## Remove the compiled API binary
	rm -rf $(API_DIR)/bin
