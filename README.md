# Brew Log

A phone app for logging coffee brews: bean, roaster, roast, method, recipe (temperature, grinder and clicks, bloom, pours, drawdown), flavours from the SCA flavour wheel, and whether it worked. Insights show your taste profile per method, your grind and temperature sweet spots per bean, and what separates good brews from bad ones.

It is a Progressive Web App (PWA) made of plain HTML, CSS and JavaScript. There is no build step, no account and no server. **Everything you log stays on your phone** (in the browser's IndexedDB). The only network use is loading the app files from GitHub Pages; after the first load it works offline.

## Put it on GitHub Pages

1. Create a new repository on GitHub, for example `brew-log`.
2. Upload everything in this folder to the repository root (on github.com choose **Add file > Upload files** and drag in the contents, including the `css`, `js` and `icons` folders and the `.nojekyll` file).
3. Go to **Settings > Pages**. Under **Build and deployment** pick **Deploy from a branch**, branch `main`, folder `/ (root)`, then **Save**.
4. After a minute the site is live at `https://<your-username>.github.io/brew-log/`.

## Install on Android

1. Open the Pages URL in **Chrome** on your phone.
2. Tap the **⋮** menu, then **Install app** (or **Add to Home screen**).
3. Open Brew Log from its home-screen icon. In **Settings** tap **Protect my data** once.

Long-press the icon for a **New brew** shortcut.

## Using it

- **Brews**: your log. Tap **+ New brew**, pick the bean and method, fill in the recipe, use the timer if you like, then tap flavours on the wheel and mark the brew **Worked**, **Okay** or **Didn't work**.
- **Clone & tweak** on any brew starts a new log with the same recipe, so you only change what you adjusted. When you choose a bean and method, the form offers the best-scoring recipe so far.
- **Beans** and **Grinders**: keep these lists once, then pick from dropdowns. Each grinder records what its setting counts (clicks, notches...), because settings are only comparable within one grinder.
- **Insights**: *Taste* (heat-map flavour wheel per method), *Dial-in* (score, balance or strength against grind setting, temperature, ratio, time or days off roast), *What worked* (average recipe of worked, okay and failed brews).
- **Settings**: back up, restore, export CSV, add custom brew methods.

## Back up your data

Because nothing is stored online, clearing Chrome's site data or uninstalling the app erases your logs. In **Settings** tap **Save backup file** now and then (or **Share backup** to send it to Drive, WhatsApp or email through Android's share sheet). The same file restores your logs on any phone or laptop via **Restore from file**. The app nudges you if it has been over 30 days.

## Updating the app

The service worker fetches fresh files whenever you are online, so after you push changes to GitHub the app updates itself the next time you open it with a connection (close and reopen it once if it still shows the old version). If you add or rename files in `js/`, add them to the `SHELL` list in `sw.js` so they are available offline.

## Run it on your computer

Any static server works, for example `python3 -m http.server 8000` in this folder, then open `http://localhost:8000`.

## Flavour wheel credit

Flavour descriptors follow the Coffee Taster's Flavor Wheel by the Specialty Coffee Association (SCA) and World Coffee Research (WCR), 2016, which is licensed CC BY-NC-ND 4.0. This app uses it for personal, non-commercial logging. If you publish the repository, keep it non-commercial and keep this credit, and check the SCA's terms at https://sca.coffee/research/coffee-tasters-flavor-wheel before redistributing anything derived from the wheel.
