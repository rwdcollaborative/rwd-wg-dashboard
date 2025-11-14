.PHONY: help install preview render clean serve check-deps

# Default target - show help
help:
	@echo "RWD Working Group Dashboard - Available Commands"
	@echo "================================================"
	@echo ""
	@echo "Setup & Installation:"
	@echo "  make install      - Install R packages and dependencies"
	@echo "  make check-deps   - Check if Quarto and R are installed"
	@echo ""
	@echo "Development:"
	@echo "  make preview      - Start live preview server (auto-reload on changes)"
	@echo "  make render       - Build the dashboard once (output to _site/)"
	@echo "  make serve        - Serve the built site locally (no auto-reload)"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean        - Remove generated files (_site/, .quarto/)"
	@echo ""
	@echo "Quick Start:"
	@echo "  1. make check-deps"
	@echo "  2. make install"
	@echo "  3. make preview"

# Check if required tools are installed
check-deps:
	@echo "Checking dependencies..."
	@command -v quarto >/dev/null 2>&1 || { echo "❌ Quarto not found. Install from: https://quarto.org/docs/get-started/"; exit 1; }
	@command -v R >/dev/null 2>&1 || { echo "❌ R not found. Install from: https://cran.r-project.org/"; exit 1; }
	@echo "✅ Quarto found: $$(quarto --version)"
	@echo "✅ R found: $$(R --version | head -n1)"
	@echo ""
	@echo "All dependencies are installed!"

# Install R packages
install:
	@echo "Installing R packages..."
	@echo "This may take 2-5 minutes..."
	@R -e 'packages <- c("googlesheets4", "dplyr", "ggplot2", "plotly", "lubridate", "tidyr", "scales", "DT", "rmarkdown", "knitr"); new_packages <- packages[!(packages %in% installed.packages()[,"Package"])]; if(length(new_packages)) install.packages(new_packages, repos="https://cloud.r-project.org"); cat("\n✅ All R packages installed!\n")'

# Start live preview server with auto-reload
preview:
	@echo "Starting live preview server..."
	@echo "Dashboard will open in your browser"
	@echo "Press Ctrl+C to stop"
	@echo ""
	quarto preview

# Build the site once
render:
	@echo "Rendering dashboard..."
	quarto render
	@echo ""
	@echo "✅ Dashboard built successfully!"
	@echo "Output is in: _site/"

# Serve already-built site (no auto-reload)
serve:
	@echo "Serving pre-built site..."
	@echo "Open: http://localhost:8080"
	@echo "Press Ctrl+C to stop"
	@echo ""
	@cd _site && python3 -m http.server 8080

# Clean generated files
clean:
	@echo "Cleaning generated files..."
	rm -rf _site/
	rm -rf .quarto/
	@echo "✅ Clean complete!"

