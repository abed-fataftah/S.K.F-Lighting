# Mobile app

Part of the [S.K.F Lighting scope](index.md). The shop as an app on a phone, after launch: installable from the browser first, then on Google Play. The App Store waits (see Deferred in the index).

## Slice 11: Mobile app

### 40. Installable web app · planned · needs a decision
Make the live site installable from the browser: an icon on the home screen, a splash screen, full screen without the browser bar, and a friendly offline page. This is the ground the store listings stand on.
**Done when:** on Android and iPhone the browser offers to install the shop, the installed app opens Home full screen with the shop icon and name in Arabic, and opening it with no connection shows the offline page instead of a browser error.
- [ ] Design it (spec): `/architect installable web app`

### 41. Google Play listing · planned · needs a decision
Publish the installed web app to Google Play as a wrapped web app, so customers find it in the store and it opens the live site with no browser bar.
**Done when:** the app is live on Google Play under the shop's name, opens the live site full screen, the site's ownership link verifies, and a site deploy updates the app with no store release.
- [ ] Design it (spec): `/architect google play listing`
