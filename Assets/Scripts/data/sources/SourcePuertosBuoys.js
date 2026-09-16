

const BUOY_IDS = {
  "2798": "BEGU",
  "1731": "PBCN",
  "1712": "PTARR",
  "2720": "MTARR"
}

const API_BASE_URL = "https://movil.puertos.es/cma2/app/CMA/adhoc/station_data?station={{id}}&params={{params}}&from={{sYear}}{{sMonth}}{{sDay}}@{{sHour}}{{sMinute}}&to={{eYear}}{{eMonth}}{{eDay}}@{{eHour}}{{eMinute}}";

class SourcePuertosBuoys extends SourceBuoys {
  


}

export default SourcePuertosBuoys;