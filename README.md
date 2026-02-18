# RWD Working Group Dashboard

A professional, interactive dashboard for visualizing Real World Data (RWD) Working Group data from Google Sheets, built with Quarto and R, and automatically deployed to GitHub Pages.

## 🚀 Features

- **Real-time Data Loading**: Fetches data directly from public Google Sheets on each page visit
- **Interactive Visualizations**: Beautiful, interactive charts powered by Plotly
- **Structured Data Entry**: Browser-based submission form with validation and optional Google Apps Script writeback
- **Professional Design**: Modern, responsive UI with custom theming
- **Automated Deployment**: GitHub Actions automatically builds and deploys to GitHub Pages
- **Zero Maintenance**: No server required - fully static site hosted on GitHub Pages

## 📋 Prerequisites

To work with this project locally, you'll need:

- [R](https://www.r-project.org/) (version 4.0 or higher)
- [Quarto](https://quarto.org/docs/get-started/) (version 1.3 or higher)
- [Git](https://git-scm.com/)

## 🛠️ Setup Instructions

### 1. Clone and Initial Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd rwd_wg

# Check dependencies and install R packages
make check-deps
make install
```

> **Using Make**: This project includes a `Makefile` for convenience. Run `make help` to see all available commands.

### 2. Configure Your Google Sheet

1. Create or prepare your Google Sheet with data
2. Set sharing to **"Anyone with the link can view"** (for public access)
3. Copy the full URL of your Google Sheet
4. Open `index.qmd` and replace `YOUR_GOOGLE_SHEET_URL_HERE` with your sheet URL

```r
# In index.qmd, around line 30:
SHEET_URL <- "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit"
```

### 3. Configure Submission Form (Google Apps Script)

The `submit.qmd` page can write new entries to the `Inventory` tab through a Google Apps Script Web App.

1. Open your Google Sheet and create an `Options` tab (recommended) with one column per dropdown list:
   - `Type`
   - `Topic`
   - `RWD Type`
   - `Intended Audience`
   - `Artifacts Included`
   - `Availability`
   - `Credentials Offered`
2. Seed options in one of two ways:
   - Import `data/options_template.csv` into the `Options` tab (recommended baseline from current inventory values), or
   - Enter your own allowed values under each header column.
3. Create a new Apps Script project from the same sheet and paste in `apps_script/Code.gs`.
4. Add these metadata headers to row 2 of the `Inventory` sheet (you can hide these columns):
   - `Meta Created At`
   - `Meta Updated At`
   - `Meta Source`
   - `Meta URL Status`
   - `Meta URL Checked At`
   - `Meta URL Check Detail`
   The script writes only to these metadata columns and does not overwrite inventory data columns.
5. Deploy as a Web App:
   - Execute as: `Me`
   - Who has access: `Anyone` (or your preferred allowed audience)
6. Set `defaultSubmitUrl` in `submit.qmd` to your Web App `/exec` URL.
7. Optional smoke test: open the `/exec` URL in a browser and confirm it returns JSON with `ok: true`.
8. Configure submission token (required for hardened submit endpoint):
   - In Apps Script: `Project Settings` -> `Script properties` -> add `SUBMIT_TOKEN`.
   - In GitHub repo secrets: add `SUBMIT_TOKEN` with the same value.
   - For local rendering: set env var `SUBMIT_TOKEN` before `quarto render`.

With this setup:
- Form submissions write `Meta Created At`, `Meta Updated At`, and `Meta Source = form`.
- Direct sheet edits automatically update `Meta Updated At` and `Meta Source = manual` via `onEdit(e)`.
- The dashboard freshness cards use these metadata columns when available.
- URL health can be tracked in `Meta URL Status`, `Meta URL Checked At`, and `Meta URL Check Detail`.
- Submit endpoint protections include token verification, validation, formula-injection protection, global rate limits, and short-window duplicate suppression.

### 3b. Optional Daily URL Checker (GitHub Action)

This repository includes `.github/workflows/url-link-check.yml` to check all inventory URLs daily and write link-health metadata back to the sheet.

Required repository secrets:
- `GOOGLE_SERVICE_ACCOUNT_JSON`: full JSON key for a Google service account
- `RWD_SHEET_ID`: spreadsheet ID (the long ID in the sheet URL)
- `SUBMIT_TOKEN`: token injected at build-time for the submission form (must match Apps Script Script Property)

Important:
- Share the Google Sheet with the service account email as an Editor.
- The checker updates only:
  - `Meta URL Status`
  - `Meta URL Checked At`
  - `Meta URL Check Detail`

### 4. Customize the Dashboard

Modify `index.qmd` to match your data structure:

- Update column names in the data processing code
- Adjust metrics calculations
- Customize visualizations
- Add or remove sections as needed

### 5. Preview Locally

```bash
# Start live preview with auto-reload
make preview
```

This will open a browser with your dashboard. The page will automatically reload when you make changes to the code.

**Other useful commands:**
- `make render` - Build the site once (output to `_site/`)
- `make clean` - Remove generated files
- `make help` - See all available commands

## 🚢 Deployment to GitHub Pages

### First-Time Setup

1. **Create a GitHub Repository**:
   ```bash
   # Add your remote repository
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   ```

2. **Enable GitHub Pages**:
   - Go to your repository on GitHub
   - Navigate to **Settings** → **Pages**
   - Under "Build and deployment", select **Source**: GitHub Actions

3. **Push Your Code**:
   ```bash
   git add .
   git commit -m "Initial commit: Dashboard setup"
   git push -u origin main
   ```

4. **Automatic Deployment**:
   - The GitHub Action will automatically run on push to `main`
   - After 2-3 minutes, your dashboard will be live at:
     `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

### Scheduled Updates (Optional)

To automatically refresh your dashboard data on a schedule:

1. Open `.github/workflows/publish.yml`
2. Uncomment the schedule section:
   ```yaml
   schedule:
     - cron: '0 0 * * *'  # Daily at midnight UTC
   ```
3. Commit and push the change

Common cron schedules:
- `0 0 * * *` - Daily at midnight
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 1` - Weekly on Mondays

## 📁 Project Structure

```
rwd_wg/
├── .github/
│   └── workflows/
│       └── publish.yml      # GitHub Actions deployment workflow
├── apps_script/
│   └── Code.gs              # Google Apps Script endpoint for form submissions
├── data/
│   └── options_template.csv # Starter options list for the Options tab
├── _quarto.yml              # Quarto project configuration
├── index.qmd                # Main dashboard page
├── submit.qmd               # Data entry form page
├── about.qmd                # About page
├── custom.scss              # Custom SCSS theming
├── styles.css               # Additional CSS styles
├── DESCRIPTION              # R package dependencies
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

## 🎨 Customization

### Styling

- **Colors and Theme**: Edit `custom.scss` to change colors, fonts, and overall theme
- **Layout**: Modify `styles.css` for layout adjustments
- **Quarto Theme**: Change the theme in `_quarto.yml` (options: cosmo, flatly, darkly, etc.)

### Content

- **Dashboard Title**: Update in `_quarto.yml` and `index.qmd`
- **Metrics**: Modify the "Key Metrics" section in `index.qmd`
- **Visualizations**: Add, remove, or customize plots using ggplot2 syntax
- **About Page**: Edit `about.qmd` with your project information

## 📊 Data Requirements

Your Google Sheet should be structured with:
- Column headers in the first row
- One row per record
- Dates in a consistent format (recommended: YYYY-MM-DD)

Example structure (modify to match your needs):
```
date        | metric1 | metric2 | category | status
2024-01-01  | 100     | 45      | Type A   | Active
2024-01-08  | 105     | 52      | Type B   | Complete
```

## 🐛 Troubleshooting

### Dashboard won't load data from Google Sheets

- Ensure your sheet is set to "Anyone with the link can view"
- Verify the URL is correct in `index.qmd`
- Check that column names match your code
- Review the GitHub Actions logs for error messages

### GitHub Actions deployment fails

- Check the Actions tab in your GitHub repository for error logs
- Ensure GitHub Pages is enabled in repository settings
- Verify all R packages are listed in the workflow file

### Local preview not working

- Ensure Quarto is installed: `quarto --version`
- Ensure R packages are installed
- Try rendering manually: `quarto render`

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests
- Improve documentation

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🔗 Useful Links

- [Quarto Documentation](https://quarto.org/docs/guide/)
- [googlesheets4 Package](https://googlesheets4.tidyverse.org/)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

**Need help?** Open an issue or contact the project maintainers.
