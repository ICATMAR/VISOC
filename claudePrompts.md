DTAPBuoys -> show significant wave height (blue) and wind (yellow) bars.
Similarly to DTAPHFR, show the list of buoys and this time I want you to show some mockup data. Create mockup data for wind speed and wave significant height. The data cells should be this way: if no data, background is gray. If data, background is lightBlue. There are two vertically-growing bars: up goes sign. wave height and downward wind speed. They both start at the middle of the cell, but wave increases upwards and wind downwards. The upper max limit of wave is 2.5 meters. The wind upper max is 30 knots (turn it into km/h). If wave or wind surpass this limit, the bar should be 50% cell height.
The current DTAPBuoysPlatformDetail  should be moved to DTBPlatformDetail inside the folder DataTimeline > Buoys for later use. And actually the data points of the DTTimlineGrid should be inside the DTBuoys. What is the function of DTTimelineGrid? I thought it was used as a component inside DTAPHFR and all Datatimelines so it is in one single place instead of duplicated code all over all DataTimelines.

DTAPBuoys>
Data is generated in RequestsManager (same as in HFRadar). Actually generate also wave direction and wind direction and current (direction HCDT and speed HCSP) and temperature and salinity (TEMP, PSAL). Use in the request manager these abbreviations (data comes like this from the API): WSPD, WDIR: wind speed and direction; VHM0, VMDR: sign. wave height and significant wave direction. This component fetches WSPD and WHM0.
> Style of data cells
- When hovering, highlight both bars. You can use a CSS filter if it is simpler when hovering on the parent cell of the bars. Same with selected cell. Use a CSS filter to highlight the selected cell (increase contrast or work with HSV).
- Add html property title saying Wave height X m, Wind speed X km/h (use $t(...) -> ready for i18n translations. When no data is available, title should say no data availalbe or similar.


DTAPBuoysPlatformDetail >
When user clicks on data cell (DTAPBuoys), PlatformDetail should show:
- A map with current, wind and wave. Adapt MapCircleArrows (you will have to adapt DTBPlatformDetail) so that it shows the selected data.
- Center part: move location next to Buoy. It should be Buoy - Xº N, Yº E
- Variable rounded rectangles: show temperature and salinity
- Add button to switch to Buoys dashboard. 
- The total height of the PlatfromDetail should not exceed 180px. Make it so that the data fits (you can make the variable rounded rectangles smaller for example)
- Rembmer to use i18n - $t('') when it should be used (Buoys, Temperature, wind... any translatable text).

_____________________

Good work. Some changes in pltaform detail:
Be consistent with the platform detail layout between platforms, in the central information panel
First line: type of platform · lat-long. Lat-long should be selectable (user can copy it). You can add an icon next to location with the same text style to copy it. Use fa-icons. Lat-long should have 4 decimals for HFRadar and two decimals for the buoy.
Second line: name of the station. Style is good. Add a smaller text with: a green/yellow/gray circle and then a text saying Active/Delayed/Inactive. Style of this small text is the same as first line. This should be related with Now and the latest data available. Please create this feature (for HFR and Buoys). Move here the depth of the buoy and write X m depth (with i18n option).
Third line - only when data cell is selected: Date selected
Fourth line - only when data cell is selected: variables and values. Use text size of HFR for buoys also (right now buoys is too big). The fourth line might take a lot of space for some platforms. Let's limit it's height and make it overflow-x as in the variables are stacked horizontaly and user can scroll horizontally through them. Scroll should only be visible when there are a lot of variables.
Bottom: switch to dashboard. Use the icon of the menu. Text should be '<Icon> Switch to X dashboard" with i18n.

Keep space on the right, I want to show a circular image/gif as it is done in DTBPlatformDetail 3D DTO html section. For the buoys, use this html section. For the HFR radar, use the images in Assets/Images/platforms/HFR and show them with a circular shape. No external link icon.

I don't think we need to create a unified view or layout for the platform details. Nevertheless it would be good to share the css styles. Consider creating a css file (platformDetails.css)


Bug fix:
Replication: Data cell is selected. User changes platform (of the same type, e.g. from buoy A to B) by clicking on map icon. Data cell is still selected but platform is different. Instead of unselecting the data cell, use the same timestamp and select the new data cell of that new platform. This only works when the platforms are the same type (e.g. buoy A then click on buoy B, not buoy A then click on HFR A).



____________________

Platform detail > Central part > Variables
- Make that the user can scroll by click and drag (as in DataTimeline)
- Express directions (wind and waves) as arrows (use fav-icon location-arrow - this icon is rotated clockwise 45º by default) next to the value, not as a single variable. As in wave height X m <arrow>

Platform detail > Central part > Switch to dashboard button
- Button to switch platforms. I prefer if the icon is in black and with a circle background as is the icon on the map or on the menu. Put this icon on top of the button and make it that it is some pixels bigger. Icon circle on the left starts the button, button continues below with a smaller height (4 px smaller). The current height of the button is correct, so make the icon bigger. Create a css style that is reused between platformdetail views.
- Add text "dashboard" to switch button

Platform detail > Central part > Top text > HFR. Do not abbreviate HFR, write High-frequency radar station.
Platform detail > Central part > Top text > Buoy. Put here the depth, no on the third line
Platform detail > Map. Add platform icon at the correct location.


Map > Platform icons
Bug fix: double click in buoy icon, renders the platform detail without data from timestamp.

Do not import css in index.html, import it in globalStyles.css. If you think its better as you did please justify.


______________________________


DataTimeline Buoys > DataCell selected / hover. Instead of using a css filter (delete it) I want you to create an extra div on top. This div should inside the sub-cell with this style background: var(--red); height: 100%;width: 100%;opacity: 0.6;position: absolute; when the cell is selected and the same style with a background of var(--darkBlue) when it is hovered.


Platform detail > Central part > Data cell selected - Date text: add next to it "- Local time (UTC+X)" with the same style but underlined and clickable. When clicked the time reference changes and shows UTC. This button does the same as the one in DT (Local (UTC+2), i.e. the whole interface reacts to this timecode changes. You already have this in GUIManager so great.

Platform detail > Map. Previously in my version of this, the labels of currents, wind and waves were above the DataTimeline an any other element of the GUI. I would like to keep it this way. Right now the labels are hidden when outside the Platform detail container

Platform detail Buoys: map direction and variable direction do not match. There is some error there. directions are expressed clock-wise and 0º indicates north (up). keep in mind that currents direction is "towards" and wave and wind is "from". For example, wind from E or 90º should be expressed with an arrow pointing towards -90º


Platform detail > Central part, do not center it, leave it as before (content to the top, only the switch dashboard tied to bottom)
Platform detail > Central part > Bottom button: change the text and just write Switch to dashboard. The icon background should be in var(--darkBlue).

Platform detail > Central part > variables: drag should work outside the element, tie the event to the document and not to the element.

Platform detail > Map. Icon should look as in the Map.vue (round blue background, shadow...). You do not need to add the red circle icatmar marker.


____________

please correct this bug:
How to reproduce: Platform detail is open and a data cell is selected. User closes platform detail and clicks on another data cell. The error: the previous data cell shows as selected when clicking on another data cell, only when clicking again the desired data cell is then selected.

_____________


When switching dashboards, hide platform detail and Datatimeline.

on the datatimeline, where the buoy and hfr's names are displayed, also make them clickable. If user clicks them, the platform is selected on the map (platform detail update also).

________________



In the DT of HFR, add the Total velocities row. This row should be on the top and separated by a horizontal line from the others (use solid border bottom of the cells maybe?). It is the product of all other stations. The abbreviation is TOTALS. When clicked, the platform detail is slightly different (you will have to create a different PlatformDetail with id HFRTotals (instead of HFR or Buoys):
- first line: Sea water velocities data product
- second line: HF radar network
- third line: active
- fourth line (when datacell is clicked), number of valid points, exactly as in DTAPHFR platform detail. Also add number of active stations (mockup data) - from 0 to number of stations (7). 
- bottom: same as DTAPHFR platform detail (switch to dashbord), with the same icon, colors...
You will have to create separate mockup data (for data cells and state of product)
For the platform detail map, you should show the map and small icons where the stations are located. The zoom level should allow all stations to be seen. Remove the right-sided circular image on the platform detail.

Platform detail > Map (HFR): Add central round circle or small icon where the map is centered (location of station)

When a datacell or map icon is clicked, the map icon should react. The icon should have a var(--red) background (the class already exists if I am not wrong). When the HFRTotals is selected, all stations should turn red.

___________

Map icon highlight errors:
- buoy map icon is not reacting when buoy is selected, please do
- map icon keeps selected when switching dashboards (it should be deselected)

_____________



Datatimeline data cells of HFR: the data cell is clickable, not the columns, e.g., if a datacell has 1 or very little valid points the user won't be able to select the datacell. you can reuse the same idea as in DTBuoys: an overlayed div with opacity: blue when hovered, red when clicked. Share the CSS styles if possible (feel free to create a new .css file if there is too much duplication of styles)

____________


let's do an iteration to improve the style of the data cells in HFR. They represent the number of available points, that's why they are in a column (not a point in the y-axis). What other style do you suggest? Maybe also adding a horizontal bar to separate them? making them taller? I dont know, suggest your best


___________________

Lets work on the information panel of the dataTimeline. here it should say the funding institutions and who owns the platform, manufacturer, type... This information is common to all Datatimelines, e.g., All Platforms > HFR > DT will have the same info as HFR dashboard > Datatimeline
Let's start with HFR (stations and totals)
Name and abbreviation (e.g., CREU · Cap de Creus)
Institution: ICATMAR (for all but CNET, which is CEFREM) --> add link that opens in a new page for icatmar.cat and CEFREM (https://cefrem.univ-perp.fr/).
Manufacturer: CODAR SeaSonde
Measurement frequency: 13.5 MHz
Installation date: Month, Year --> mockup data
Last calibration: unknown

Acknowledgement: ICATMAR HF Radar Network has been established with the support of the European Maritime and Fisheries Fund, the European Maritime, Fisheries and Aquaculture Fund and the fund provided by the Government of Catalonia. The network has been designed, implemented and managed through the efforts of the Direcció General de Política Marítima i Pesca Sostenible (Government of Catalonia) and the Insitut de Ciències del Mar (CSIC), Barcelona.

License: https://creativecommons.org/licenses/by/4.0/. (put an icon or something or just CC-BY 4.0 linked to this webiste.

Also add a picture of the station (only if available)

You can put this information and data structures in the requests manager. We will organize it better later.