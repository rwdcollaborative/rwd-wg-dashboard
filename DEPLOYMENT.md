# Quick Deployment Guide

## 🚀 Deploy to GitHub Pages in 5 Steps

### 1. Create GitHub Repository

Go to [GitHub](https://github.com/new) and create a new repository (e.g., `rwd-wg-dashboard`)

### 2. Connect and Push

```bash
cd /Users/oneilsh/Documents/projects/tislab/ctsa/rwd_wg

# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/rwd-wg-dashboard.git

# Push your code
git push -u origin main
```

### 3. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages** (in the left sidebar)
3. Under "Build and deployment":
   - **Source**: Select "GitHub Actions"
4. Save

### 4. Wait for Deployment

- Go to the **Actions** tab in your repository
- You'll see the "Publish Dashboard to GitHub Pages" workflow running
- Wait 2-3 minutes for it to complete

### 5. View Your Dashboard

Your dashboard will be live at:
```
https://YOUR_USERNAME.github.io/rwd-wg-dashboard/
```

## 🔄 Automatic Updates

The dashboard will automatically:
- Rebuild when you push changes to the `main` branch
- Fetch fresh data from Google Sheets on each page visit

## 📅 Optional: Scheduled Rebuilds

To automatically rebuild the dashboard daily (to refresh any cached data or update the "last updated" timestamp):

1. Edit `.github/workflows/publish.yml`
2. Uncomment these lines:
   ```yaml
   schedule:
     - cron: '0 0 * * *'  # Daily at midnight UTC
   ```
3. Commit and push the change

## 🧪 Test Locally First (Optional)

If you have Quarto and R installed:

```bash
# Install R packages (one time)
R -e 'install.packages(c("googlesheets4", "dplyr", "ggplot2", "plotly", "lubridate", "tidyr", "scales", "DT", "rmarkdown", "knitr"))'

# Preview the dashboard
quarto preview
```

## 🐛 Troubleshooting

**Dashboard shows errors:**
- Check that the Google Sheet is public (shareable link with "Anyone can view")
- Verify the sheet has an "Inventory" tab
- Check the Actions tab on GitHub for detailed error logs

**Plots look strange:**
- The data structure may have changed - check column names in `index.qmd`
- Some columns might be empty - this is fine, the code handles missing data

**GitHub Actions fails:**
- Check the Actions tab for the error message
- Most common issue: GitHub Pages not enabled in Settings → Pages

## 📝 Customization

After deployment, you can customize:
- Colors: Edit `custom.scss`
- Layout: Edit `styles.css`
- Visualizations: Edit `index.qmd`
- Content: Edit `about.qmd`

Just commit and push changes - the site will automatically rebuild!

