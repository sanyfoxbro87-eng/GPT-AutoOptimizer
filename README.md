ChatGPT Auto Optimizer

A browser extension that automatically optimizes long ChatGPT conversations and helps reduce interface lag when a chat contains many messages.

About

When a conversation becomes very long, the ChatGPT page may start to lag: scrolling becomes slower, the page may freeze, opening the chat can take longer, and the browser load increases.

ChatGPT Auto Optimizer is designed to automatically reduce page load by:

optimizing older messages;
reducing the number of heavy DOM elements;
working automatically when a chat is opened;
re-running when the page changes.
Features
Automatic optimization of long chats
Works in already opened chats
Works when switching to new chats
Real-time page change detection
Reduced UI load
Saved settings between browser restarts
Built-in status box with information:
Found — how many messages were found
Kept — how many messages were kept fully visible
Pruned — how many messages were reduced, simplified, or hidden
How it works

The extension scans the ChatGPT page, finds messages in the current conversation, keeps the most recent messages intact, and simplifies, hides, or replaces older ones with lighter elements.

This helps reduce browser load and makes long conversations more responsive.

Installation
Google Chrome / Chromium / Brave / Edge
Download or clone this repository
Extract the archive if you downloaded a ZIP file
Open the extensions page in your browser:
Enable Developer mode
Click Load unpacked
Select the project folder

After that, open ChatGPT and navigate to a long conversation.

Usage

After installation, the extension starts working automatically.

What to do
Open ChatGPT
Open a long chat
Wait a few seconds
Check the extension status panel on the page

Example:

If the extension finds messages but the chat still lags, possible reasons include:

the chat is extremely large;
it contains many images or heavy code blocks;
the browser is overloaded with other tabs or extensions;
the current ChatGPT layout has changed.
Project structure
Use cases

This extension is useful if you:

keep very long ChatGPT conversations;
work on large projects inside a single chat;
often notice lag, freezes, or slow scrolling;
want automatic optimization without manual actions.
Limitations

It is important to understand that the extension:

speeds up the page interface only;
does not change the model’s internal memory;
does not affect how ChatGPT processes context on the server;
depends on the current ChatGPT page structure.

If OpenAI changes the website HTML structure, the extension may require updates.

Roadmap
More accurate message detection
Better code block optimization
Image and media optimization
Export old messages to Markdown
More flexible settings
Aggressive optimization mode
Support for multiple optimization strategies
Development

If you want to improve the project:

Clone the repository
Edit the source files
Reload the extension on chrome://extensions/
Test it in ChatGPT
Debugging

If the extension does not work as expected:

open the browser developer console;
check for errors on the ChatGPT page;
see whether the status panel is visible;
verify whether the extension can find messages.
Contributing

Pull requests, ideas, and improvements are welcome.

If you want to help the project:

report bugs;
suggest improvements;
test on different browsers;
share your own optimization ideas.
Disclaimer

This project is an unofficial tool and is not affiliated with OpenAI.
ChatGPT is a product of OpenAI.

The extension works only on the browser side and changes page rendering to improve usability.
