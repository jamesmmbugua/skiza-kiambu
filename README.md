# Yvonne Waweru: Skiza Kiambu

Campaign map, dashboards and community needs tool for Yvonne Waweru, DCP aspirant for Kiambu County Woman Representative, with Kabete Constituency as her home base. Styled in DCP colours (green, lime, brown and white) around the party slogan *Skiza Wakenya*.

It has five parts:

1. **Yvonne (home page)**: photo, party, slogan, bio, priorities, contact links and live counts of what residents are reporting.
2. **Map**: Kiambu County boundary, its 12 constituencies and 60 wards, with Kabete highlighted. Wards can be coloured by registered voters, voters per km², area, or the number of community needs reported. Tap a ward for its figures.
3. **Dashboard**: an interactive map on the left and a live panel on the right. Tap any ward (or pick one from the Jump to list) and the panel updates with its voters, share, rank, area, density, population and the needs residents have reported there. Breadcrumbs move back up to the constituency or the whole county.
4. **Skiza (community needs)**: a citizen science form. Anyone can drop a pin, choose a category (water, roads, health, women economic empowerment, and so on), describe the need and rate its urgency. The ward is detected automatically. Reports appear on the map and in the dashboard and can be exported as CSV or GeoJSON.
5. **Data**: sources and method notes.

It is a static site (HTML, CSS, JavaScript, GeoJSON). No server or build step is needed.

## Publish on GitHub Pages

1. Create a new repository on GitHub, for example `skiza-kiambu`.
2. Upload everything in this folder (keep the folder structure). On a phone you can use "Add file > Upload files" on github.com.
3. In the repository go to **Settings > Pages**. Under "Build and deployment" choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
4. After a minute the site is live at `https://YOUR-USERNAME.github.io/kabete-campaign-map/`.

To test on a computer before publishing, run `python3 -m http.server` in this folder and open `http://localhost:8000`. Opening `index.html` directly from disk will not load the data files.

## Collecting reports from everyone (optional)

By default, each report is saved only in the browser that submitted it. That works for a field team that exports and merges files, but to gather reports from the public into one place:

1. Follow the steps at the top of `apps-script/Code.gs` to create a free Google Sheet backend.
2. Paste the web app URL into `js/config.js` as `submitEndpoint`.
3. Commit the change. New reports now go to the sheet, and the map shows every approved report.

Names and phone numbers stay in the sheet and are never shown on the public map. To hide a report, change its `approved` cell to `no`.

## Photo and branding

1. Save Yvonne's photo as `assets/yvonne.jpg` (square, at least 400 x 400 px). It appears in the header, on the home page and in link previews on WhatsApp and Facebook. Her initials show until it is added.
2. Optionally add the official party logo as `assets/dcp-logo.png`.
3. In `js/config.js`, update her bio, the priorities (the current ones are drafts) and her WhatsApp, phone, email and social links.

## Customising

- `js/config.js`: candidate profile, needs categories, shared sheet URL, extra map indicators.
- `data/stats.json`: county and sub-county figures used in the dashboard.
- `data/wards.geojson`: one feature per ward. Add your own numeric properties (for example 2022 Woman Rep votes, polling stations, women groups) and list them under `extraIndicators` in `config.js` to colour the map by them.

## Basemaps

All basemaps are free and need no API key: OpenStreetMap (default), Esri Light Grey and Esri Satellite. Switch between them with the layers button on each map.

## Data notes

| Data | Source |
|---|---|
| County, constituency and ward boundaries | [kenya-geo](https://github.com/gaithoben/kenya-geo), IEBC-derived polygons, simplified |
| Registered voters per ward and constituency, 2022 | [IEBC per ward](https://www.iebc.or.ke/docs/rov_per_caw.pdf), [IEBC per constituency](https://www.iebc.or.ke/docs/rov_per_constituency.pdf) |
| Census 2009 and 2019 by sub-county, sex, age | KNBS, via [City Population](https://www.citypopulation.de/en/kenya/sub/admin/22__kiambu/) |
| Kabete ward populations, 2009 | [Wikipedia: Kabete Constituency](https://en.wikipedia.org/wiki/Kabete_Constituency) |

- Ward populations for 2019 in Kabete are estimates (2009 ward figures scaled by Kabete's 2009 to 2019 growth of 42%).
- Kahawa Sukari ward (Ruiru) had no polygon in the source; its shape is approximated from Ruiru constituency minus the other Ruiru wards.
- Census sub-counties (13) do not match constituencies (12) exactly, for example Thika East and Thika West versus Thika Town.
- IEBC spells one Kabete ward "Nyadhuna"; the map uses the common spelling "Nyathuna".

## Licence

Code: MIT. Check the terms of each data source before reuse.
