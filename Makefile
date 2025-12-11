# Coral - Proto Dependency Visualizer
.PHONY: help serve dev dev-api dev-frontend build test check clean

help:
	@echo "Coral - Proto Dependency Visualizer"
	@echo ""
	@echo "Commands:"
	@echo "  make serve        Production server (auto-builds frontend)"
	@echo "  make dev          Quick dev server (existing build)"
	@echo "  make dev-api      API only (for hot reload with dev-frontend)"
	@echo "  make dev-frontend Vite dev server (run with dev-api)"
	@echo ""
	@echo "  make build        Build backend"
	@echo "  make test         Run tests"
	@echo "  make check        Format + lint + test"
	@echo "  make clean        Clean artifacts"

serve: build
	@cd frontend && npm install && npm run build
	@echo "Starting server at http://localhost:3000"
	@cd sandbox && buf build -o - | ../target/debug/coral serve --port 3000 --static-dir ../frontend/dist

dev: build
	@cd sandbox && buf build -o - | ../target/debug/coral serve --port 3000 --static-dir ../frontend/dist

dev-api: build
	@echo "API server: http://localhost:3000"
	@cd sandbox && buf build -o - | ../target/debug/coral serve --port 3000

dev-frontend:
	@cd frontend && npm install && npm run dev

build:
	@cargo build

test:
	@cargo test

check:
	@cargo fmt -- --check
	@cargo clippy -- -D warnings
	@cargo test

clean:
	@cargo clean
	@rm -rf frontend/dist frontend/node_modules
