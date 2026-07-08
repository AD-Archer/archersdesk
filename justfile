default:
	@just --list

dev:
	@if command -v infisical >/dev/null 2>&1; then \
		infisical run -- pnpm run dev; \
	else \
		pnpm run dev; \
	fi

pnpm *args:
	@if command -v infisical >/dev/null 2>&1; then \
		infisical run -- pnpm {{args}}; \
	else \
		pnpm {{args}}; \
	fi
