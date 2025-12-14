# Coral - Proto Dependency Visualizer
.PHONY: build test check dev clean

build:
	@cargo build

test:
	@cargo test

check:
	@cargo fmt -- --check
	@cargo clippy -- -D warnings
	@cargo test

dev: build
	@cd ui && npm install && npm run build
	@echo "🪸 Coral server: http://localhost:3000"
	@cd sandbox && buf build -o - | ../target/debug/coral serve --port 3000 --static-dir ../ui/dist

clean:
	@cargo clean
	@rm -rf ui/dist ui/node_modules
