# RWD Working Group Dashboard

A professional, interactive dashboard for visualizing Real World Data (RWD) Working Group data from Google Sheets, built with Quarto and R, and automatically deployed to GitHub Pages.

## 🚀 Features

- **Real-time Data Loading**: Fetches data directly from public Google Sheets on each page visit
- **Interactive Visualizations**: Beautiful, interactive charts powered by Plotly
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

# Install R packages
R -e 'install.packages(c("googlesheets4", "dplyr", "ggplot2", "plotly", "lubridate", "tidyr", "scales", "DT", "rmarkdown", "knitr"))'
```

### 2. Configure Your Google Sheet

1. Create or prepare your Google Sheet with data
2. Set sharing to **"Anyone with the link can view"** (for public access)
3. Copy the full URL of your Google Sheet
4. Open `index.qmd` and replace `YOUR_GOOGLE_SHEET_URL_HERE` with your sheet URL

```r
# In index.qmd, around line 30:
SHEET_URL <- "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit"
```

### 3. Customize the Dashboard

Modify `index.qmd` to match your data structure:

- Update column names in the data processing code
- Adjust metrics calculations
- Customize visualizations
- Add or remove sections as needed

### 4. Preview Locally

```bash
# Render and preview the dashboard
quarto preview
```

This will open a browser with your dashboard at `http://localhost:4200`

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
├── _quarto.yml              # Quarto project configuration
├── index.qmd                # Main dashboard page
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

