# Salesboard / ChannelPilot

Multichannel sales and contribution-profit dashboard pilot. **Deployment is not yet complete.** The repository currently has Render configuration and Docker dependencies; application source files must still be uploaded before applying the Blueprint.

## Finish uploading source

Download `salesboard_upload_remaining.zip` from the ChatGPT conversation, extract it, then use GitHub **Add file → Upload files** to upload the extracted files and `static/` and `tests/` folders to the repository root. Preserve folder structure. Never upload `.env`, actual API credentials, customer exports, or local database files. Confirm `main.py`, `models.py`, `finance.py`, `providers.py`, `static/index.html`, `static/app.js`, and `static/app.css` appear in the GitHub repository.

## Deploy

After all files are present, open https://dashboard.render.com/blueprint/new?repo=https://github.com/behappyprep/Salesboard and review the proposed Frankfurt web service and PostgreSQL database. The blueprint specifies **paid** resources; do not click Apply unless you accept the charges. After deployment verify `/health` returns OK, then configure real provider OAuth credentials in Render's secret environment settings. Shopify, Etsy and Faire credentials are not provisioned by the Blueprint. Amazon and Michaels remain CSV-only.

**Security:** This is an early pilot, not an audited customer-facing SaaS. Do not invite paying customers before implementing email verification and password reset, migration and backup procedures, privacy/retention policies, and independently reviewing security and provider reconciliation.
