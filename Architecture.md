# Architecture Data
Data product: anything that contains data. An HFR station is a data product, HFR network is a data product, a buoy is a data product.

## Requirements
### Dynamic/Cache
- Requests manager: only returns fetch. Decides if to call the url or use cached url response. If a URL was requested twice before resolving return active promise. Stores when the response was cached.
- Source data: erddap, msm, static file... Different sources per data product.

### Static information (or requested once when loading)
- Catalog: list of all available data products. It contains all static data. It will be different per platform. Also static metadata.
- Sources per data product. HFR stations have two ERDDAPs, drifters have static files and ERDDAP, buoys have ERDDAP, MSM, puertos and static files.
- List of all variables, metadata and units per source.
- Observed properties! List of observed properties

### Status
- Source/API/Proxy status. First proxy, then ERDDAPs, APIs... Maybe on startup? Or create a separate website or view inside VISOC?
- Data product stats (active, delayed, inactive). Check what is the latest data, how many active etc...

### Functionalities
- Parser: Parse raw data from source -> in DataSource
- Aggregator: Aggregate data from different sources
- FetchPlanner: decides which data (if not loaded/loaded, date intervals, if must reload) from which source (is available, is data in range, should use multiple sources)
- Transformation of data from source to observed property (standard inside app). E.g. temperature in ºK from source, but ºC used in all data products.
- How long before data needs refresh -> in Source or in Data product? Some Sources might have slower update rates? Does it really matter?
- If source fails during request, use another data source? E.g. for HFR.
- Default source: should be a predefined source per date range? E.g. from now to X time use ERDDAP, from jan to june use static files etc... Some data products won't have static files (HFR, satellite, models), basically gridded because they take a lot of space. Maybe use if a dataset is gridded and if not, then search for start-end dates of the static files.
- Default sensor? E.g. in buoys there are two sensors measuring water temperature, set predefined.


### Files
#### StatusProvider.js
Is there a way to make a ping? instead of requesting a whole html website. Maybe each source should have a testing system, as in request a little bit of data.
  - Are you online?
  - Request proxy
  - Request ERDDAPS (ICATMAR, ifremer-Argo, NOAA-AOML OSMC)
  - Request dataset from ERDDAP list and store bbox (lat-long) and time (min-max)
  - Request custom check with MSM
  - Request custom check to ICATMAR's AIS
  - Request Puertos del Estado?

Iterate through data sources base urls for ERDDAP and fill data for ERDDAP's datasets present in data sources (time range). Also double check that all ERDDAP's urls were checked in StatusProvider.

#### DataService.js
Creates a data service that initializes all systems and provides functions, such as getStatusDataServices.

