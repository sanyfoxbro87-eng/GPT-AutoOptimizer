# ChatGPT Auto Optimizer

Automatic Chrome extension for long ChatGPT conversations.

## What it does
- Watches ChatGPT pages automatically
- Finds likely conversation message blocks using several selectors
- Keeps only the newest message pairs in full form
- Replaces older messages with lightweight placeholders in strict mode
- Optionally collapses old code blocks and hides old media
- Shows a small on-page status panel with found / kept / pruned counts

## Install
1. Unzip the archive.
2. Open `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select this folder

## Notes
This extension modifies the page DOM only. It cannot change ChatGPT's backend or model context handling.
If ChatGPT changes its page structure, selectors may need to be updated in `content.js`.
