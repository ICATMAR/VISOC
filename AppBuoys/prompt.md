<!-- 

Requirements and views (mobile)

I want you to have a top fixed row that has icatmar logo plus text ICATMAR in all views (centered). on the right side of this row there should be a menu button (three horizontal lines stacked vertically - try fontawesome or similar). The menu button leads to a new view with a close button on the top left. This view shows the unit selection per group. It also permits to select the timezone (local or utc). There is an about section. there is a funding section. 

about section something like: this app is developed by <my name> <email> (ICATMAR, ICM-CSIC) and is currently in beta. If you find any mistakes or want suggestions please do not heistate to contact me. The app is open source and the code can be found at <github link>.

Funding should be like: This work is funded by the "Fons Europeu Marítim, de Pesca i d'Aqüicultura (FEMPA)" under the Catalan Institute of Research for the Governance of the Sea (ICATMAR) - BOE-A-2023-25106 and by the framework of the project “Severo Ochoa Center of Excellence” financially supported by ICM-CSIC (CEX2019-000928-S). 

--- 1st view / Main view
A list of buoys - one row per buoy
The row has
Buoy code (below in italics and smaller, the buoy name, below if it is active/delayed/inactive via colored circle and last update) | Wave data (direciton, height, period) | Wind data (direction, speed) | Sea temperature | Water current (direction, speed)

I want you to group them by Costa Brava, Barcelonès, Tarragona/Ebre. This will be a first column with the name of the group in vertical (rotated -90deg for example). The cell should contain several rows, as many as buoys in that group. Each cell will have a vertical gradient color. You will find the color palette here:
https://github.com/ICATMAR/VISAP/blob/master/data/palette.js
Costa Brava starts (north) with Llançà, Roses... If you have doubts of where a buoy should be groupped just let me know. Tordera belongs to Barcelonès. You can put this gradients in a new file called styles.css inside /AppBuoys folder. 

--- 2nd view
When a buoy is clicked, go to the buoy view
Here it is another table, each row has data from a timestamp

1st row: Back button, Buoy name (ID), 3h/1h interval button, Local time/UTC button, info button
2nd row: Day as in Saturday 29th September
X rows: Every 1 or 3 hours, show the averaged data (wave, wind, temperature, current)
Y row... more days

There are two types of rows, measurements and predictions
I want you to show a red line horizontal showing where the now time is
To differentiate btween measurements and predictions, I want you to show a different background color for the prediction rows (first cell, as the others are colored by the magnitude of the data)

Show 24h before now and 72h after. Center the table at now (vertical scroll). If there is no data for a buoy (observation) use the prediction data (in some cases the prediction data will include hindcasted/nowcasted values).

... Style
Use ICATMAR's colors and icon styles found in /styles
Use the color legends

...Cells
wave data cell:
Direction arrow
next to it Wave height, wave period
below max wave height, max wave perdiod in italics and smaller, written as Max: 1.2m, 5s

wind data cell:
Direction arrow
next to it wind speed
Below it, wind gusts in italics and smaller, written as Gusts: 15 knots

Temperature cell...
Value and color cell

The background color of the cells is based on the legends in styles/colorLegends.js. You can use GUIManager.js if it helps you in the implementattion. GUIManager also contains the unit groups and similar, so it is probably useful.

...Data fetching
Use the scripts in /VISOC to fetch the data. You will get info about the buoy availability from those scripts (ERDDAP for example, or github for SOMO buoy).



For barcelona, mix SOMO and the puertos buoy (PBCN?). Use the wind from SOMO and the wave from PBCN, water temp from SOMO. The name of the buoy is BCNS.

I want you to create a new DataProduct called DPAggregatedBuoys that uses DPBuoys and then generates the BCNS buoy. If this is not possible because of the architecture let me know before implementing.

I want you to create two new DataProducts. DPWindForecast and DPWaveForecast. You will have to create new sources. One source will be the SourceOpenMeteo, which uses the OpenMeteoAPI to get the wind forecast on the buoy's positions (check out how data is fetched in /boiasomorrostro/wind/index.html). For the wave forecast, you will create SourceErddapWaveForecast. This will use three datasets (https://erddap.icatmar.cat/erddap/index.html): WAVE_FC_CAT_WW3ARO_2p6km, WAVE_FC_CAT_WW3ECM_2p6km, WAVE_FC_MED_WW3ECM_0p125. The first two only cover the catalan sea, that will be enough for this app. You can implement the third just for completion. You will have a preference for AROME (first) over ECMWF (second). AROME dataset only predcts one day ahead, ECMWF a bit longer. So the app will show first arome and then ECMWF. You will put this information in the information panel of the buoy view.

OpenMeteo will also provide forest from different models. I want you to use AROME first and then ECMWF. You will put this information in the information panel of the buoy view.

Regarding the temperature, you will have to do something similar. You will use this ERDDAP dataset sea_surface_forecast. Temperature is abbreviated as SST. You will have to create a new DataProduct called DPSeaSurfaceForecast and a new source called SourceErddapSeaSurfaceForecast. This source will use the dataset sea_surface_forecast.

You can include these data products in the Catalogue just for completion. I am not sure if you need to use the Catalogue for this particular app, but if it make sense please do (for example the translation of variable names, units, etc for consistency).

... Other
Sort the buoys by latitude (north to south).

...Buoy info button -> new view with
- Non-interactive map showing position of the buoy/s (e.g. SOMO + PBCN)
- Picture of the buoy (VISOC/Assets/Images/platforms/Buoys)
- Some other metadata (look at bottom datatimeline info section for ideas from VISOC).
- Explain for BCNS that the wave data is from PBCN and the wind and water temperature from SOMO, and that the data is mixed in this way because of the different availability of the buoys.
First row of this seciton is back arrow, buoy name, buoy status.
- Put the institutions as text in the info section. Mainly ICATMAR, Puertos del Estado, Ifremer (AROME-HD), Copernicus (ECMWF) will appear. Ideally you should create this list from the data products and their sources that you are using.



... Loading screen
You can use the same loading screen as in:
/boiasomorrostro/wind/index.html



...Coding style
I want you to be very careful with the files outside the folder VISOC/AppBuoys. I want you to create new files for the new data products and sources, and not modify existing files. If you need to modify existing files, please let me know before doing it. Please follow the coding style of the existing files. Use the same naming conventions, indentation, and comments style.

Regarding the code of the AppBuoys/index.html, I would prefer if you keep it to one file (or three - style, index.html, main.js) and not create extra files or use any framework. Similarly to what is done in /boiasomorrostro/wind/index.html. This is a beta app just to see its use.

To be able to develop this app you will have to make requests to ERDDAP and the custom OpenMeteo API. It is likely that you wont be able to try the custom OpenMeteo API, but you can see how it works in /boiasomorrostro/wind/index.html.

I also want you to implement it as an installable app (PWA).

...Tracking and analytics
I want you to track which buoy each user clicks. It is important for me to know which buoys are mostly used. You will use WebAnalaytics (found in the folders), and included in the index.html in 
<!-- Tracker/Analytics -->
  <script>
    // Queues wa() calls made before the deferred wa.js below has loaded and
    // taken over window.wa (tracker.js flushes window.wa.q once it does).
    window.wa = window.wa || function () { (window.wa.q = window.wa.q || []).push(arguments); };

    // Chromium/Android only: fires once, right when the user finishes
    // installing via the browser's install prompt.
    window.addEventListener('appinstalled', () => wa('pwa_installed'));

    // iOS has no install event at all, so this is what stands in for it: it
    // fires on every load that is already running from the home-screen icon,
    // the only signal iOS gives that the app was installed.
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
      wa('pwa_launch_standalone');
    }
  </script>
  <script defer src="https://analytics.icatmar.cat/wa.js" data-site="Buoys App"></script>

-->